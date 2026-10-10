const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const database = require('../src/database');
const User = require('../src/models/User');

let replicaSet;
let passwordHash;

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

  await database.connect(replicaSet.getUri('hustlehub_model_test'));
  await User.init();

  passwordHash = await bcrypt.hash('ModelTestPass123!', 12);
}, { timeout: 120000 });

after(async () => {
  await database.disconnect();

  if (replicaSet) {
    await replicaSet.stop();
  }
});

test('stores a user in MongoDB with a normalised email', async () => {
  const user = await User.create({
    name: 'Model Test User',
    email: 'MODEL@EXAMPLE.COM',
    passwordHash,
    role: 'client'
  });

  assert.equal(user.email, 'model@example.com');
  assert.ok(user._id);
  assert.ok(user.createdAt instanceof Date);
});

test('the database rejects duplicate email addresses', async () => {
  await assert.rejects(
    User.create({
      name: 'Duplicate User',
      email: 'model@example.com',
      passwordHash,
      role: 'client'
    }),
    error => error.code === 11000
  );
});

test('hides the password hash unless explicitly requested', async () => {
  const user = await User.findOne({ email: 'model@example.com' });

  assert.equal(user.passwordHash, undefined);

  const loginUser = await User.findOne({ email: 'model@example.com' })
    .select('+passwordHash');

  assert.equal(
    await bcrypt.compare('ModelTestPass123!', loginUser.passwordHash),
    true
  );
});

test('rejects plaintext in the passwordHash field', async () => {
  await assert.rejects(
    User.create({
      name: 'Invalid Password User',
      email: 'plaintext@example.com',
      passwordHash: 'PlaintextPassword123!',
      role: 'client'
    }),
    error => error.name === 'ValidationError' &&
      Boolean(error.errors.passwordHash)
  );
});

test('rejects unsupported roles', async () => {
  await assert.rejects(
    User.create({
      name: 'Invalid Role User',
      email: 'invalid-role@example.com',
      passwordHash,
      role: 'owner'
    }),
    error => error.name === 'ValidationError' &&
      Boolean(error.errors.role)
  );
});