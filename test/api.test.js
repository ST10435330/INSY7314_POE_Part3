const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.JWT_SECRET =
  'test-only-secret-that-is-longer-than-thirty-two-characters';

process.env.NODE_ENV = 'test';

const app = require('../src/app');
const config = require('../src/config');
const database = require('../src/database');
const User = require('../src/models/User');

let replicaSet;

const validUser = {
  name: 'Test Freelancer',
  email: 'freelancer@example.com',
  password: 'SecurePass123!',
  role: 'freelancer'
};

before(async () => {
  replicaSet = await MongoMemoryReplSet.create({
    binary: { version: '7.0.24' },
    replSet: {
      count: 1,
      storageEngine: 'wiredTiger',
      ip: '127.0.0.1',
      args: process.platform === 'win32' ? [] : ['--nounixsocket']
    }
  });

  await database.connect(replicaSet.getUri('hustlehub_api_test'));
  await User.init();
}, { timeout: 120000 });

after(async () => {
  await database.disconnect();

  if (replicaSet) {
    await replicaSet.stop();
  }
});

test('GET /api/health reports that the API is available', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.ok(response.headers['x-request-id']);
});

test('registers a valid user without exposing a password', async () => {
  const response = await request(app).post('/api/auth/register').send(validUser);
  assert.equal(response.status, 201);
  assert.equal(response.body.user.email, validUser.email);
  assert.equal(response.body.user.password, undefined);
  assert.equal(response.body.user.passwordHash, undefined);

  const storedUser = await User.findOne({ email: validUser.email })
  .select('+passwordHash');
  assert.notEqual(storedUser.passwordHash, validUser.password);
  assert.match(storedUser.passwordHash, /^\$2[aby]\$/);
});

test('rejects duplicate registration', async () => {
  const response = await request(app).post('/api/auth/register').send(validUser);
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'ACCOUNT_EXISTS');
});

test('rejects invalid registration input', async () => {
  const response = await request(app).post('/api/auth/register').send({
    name: '<script>', email: 'invalid', password: 'weak', role: 'admin'
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  assert.ok(response.body.error.details.length >= 4);
});

test('logs in and returns a JWT', async () => {
  const response = await request(app).post('/api/auth/login').send({
    email: validUser.email,
    password: validUser.password
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.tokenType, 'Bearer');
  assert.equal(response.body.accessToken.split('.').length, 3);
});

test('returns a generic response for incorrect credentials', async () => {
  const response = await request(app).post('/api/auth/login').send({
    email: validUser.email,
    password: 'IncorrectPassword123!'
  });
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'INVALID_CREDENTIALS');
});

test('blocks a protected route without a token', async () => {
  const response = await request(app).get('/api/users/me');
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'AUTHENTICATION_REQUIRED');
});

test('allows a protected route with a valid token', async () => {
  const login = await request(app).post('/api/auth/login').send({
    email: validUser.email,
    password: validUser.password
  });
  const response = await request(app)
    .get('/api/users/me')
    .set('Authorization', `Bearer ${login.body.accessToken}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.user.email, validUser.email);
});

test('rejects malformed JSON without exposing internals', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .set('Content-Type', 'application/json')
    .send('{broken');
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_JSON');
  assert.equal(JSON.stringify(response.body).includes('stack'), false);
});

function tokenFor(user, expiresIn = '1h') {
  return jwt.sign(
    { sub: String(user._id), role: user.role },
    config.jwtSecret(),
    {
      algorithm: 'HS256',
      expiresIn,
      issuer: config.jwtIssuer,
      audience: config.jwtAudience
    }
  );
}

test('rejects a MongoDB operator supplied as the email', async () => {
  const response = await request(app).post('/api/auth/login').send({
    email: { $ne: null },
    password: validUser.password
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('rejects public registration as an admin', async () => {
  const response = await request(app).post('/api/auth/register').send({
    ...validUser,
    email: 'admin-attempt@example.com',
    role: 'admin'
  });

  assert.equal(response.status, 400);

  assert.equal(
    await User.countDocuments({ email: 'admin-attempt@example.com' }),
    0
  );
});

test('rejects passwords exceeding the bcrypt byte limit', async () => {
  const response = await request(app).post('/api/auth/register').send({
    ...validUser,
    email: 'long-password@example.com',
    password: 'Aa1!' + 'é'.repeat(40)
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('rejects an expired JWT', async () => {
  const user = await User.findOne({ email: validUser.email });

  const response = await request(app)
    .get('/api/users/me')
    .set('Authorization', 'Bearer ' + tokenFor(user, '-1s'));

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'INVALID_TOKEN');
});

test('rejects a token after its user is deleted', async () => {
  const original = await User.findOne({ email: validUser.email })
    .select('+passwordHash');

  const removedUser = await User.create({
    name: 'Removed Test User',
    email: 'removed@example.com',
    passwordHash: original.passwordHash,
    role: 'client'
  });

  const token = tokenFor(removedUser);

  await User.deleteOne({ _id: removedUser._id });

  const response = await request(app)
    .get('/api/users/me')
    .set('Authorization', 'Bearer ' + token);

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'INVALID_TOKEN');
});