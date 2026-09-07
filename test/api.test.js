const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'hustlehub-test-'));
process.env.JWT_SECRET = 'test-only-secret-that-is-longer-than-thirty-two-characters';
process.env.USERS_FILE_PATH = path.join(testDirectory, 'users.json');
process.env.NODE_ENV = 'test';

const app = require('../src/app');
const userStore = require('../src/storage/userStore');

const validUser = {
  name: 'Test Freelancer',
  email: 'freelancer@example.com',
  password: 'SecurePass123!',
  role: 'freelancer'
};

before(() => userStore.reset());
after(() => fs.rmSync(testDirectory, { recursive: true, force: true }));

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

  const storedUser = userStore.findByEmail(validUser.email);
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
