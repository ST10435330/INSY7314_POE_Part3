const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'finance-tests-only-secret-with-at-least-32-characters';
process.env.NODE_ENV = 'test';

const app = require('../src/app');
const config = require('../src/config');
const database = require('../src/database');
const User = require('../src/models/User');
const Gig = require('../src/models/Gig');
const Booking = require('../src/models/Booking');
const Transaction = require('../src/models/Transaction');
const bookingService = require('../src/services/bookingService');

let mongo, owner, otherOwner, client, otherClient, emptyOwner;
let gig, firstTransactionId;

function token(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role },
    config.jwtSecret(),
    {
      algorithm: 'HS256',
      expiresIn: '1h',
      issuer: config.jwtIssuer,
      audience: config.jwtAudience
    }
  );
}

function get(path, user) {
  return request(app)
    .get(path)
    .set('Authorization', 'Bearer ' + token(user));
}

before(async () => {
  mongo = await MongoMemoryReplSet.create({
    binary: { version: '7.0.24' },
    replSet: {
      count: 1,
      storageEngine: 'wiredTiger',
      ip: '127.0.0.1'
    },
    instanceOpts: [{
      args: process.platform === 'win32' ? [] : ['--nounixsocket']
    }]
  });

  await database.connect(mongo.getUri('hustlehub_finance_test'));

  await Promise.all([
    User.init(),
    Gig.init(),
    Booking.init(),
    Transaction.init()
  ]);

  const passwordHash = await bcrypt.hash('SecurePass123!', 12);
  const roles = [
    'freelancer',
    'freelancer',
    'client',
    'client',
    'freelancer'
  ];

  const users = await User.create(roles.map((role, index) => ({
    name: 'Finance User ' + index,
    email: 'user' + index + '@finance.test',
    role,
    passwordHash
  })));

  [owner, otherOwner, client, otherClient, emptyOwner] = users;

  gig = await Gig.create({
    title: 'Logo design',
    description: 'A simple logo design service.',
    priceCents: 45050,
    freelancer: owner._id
  });

  const otherGig = await Gig.create({
    title: 'Website design',
    description: 'A simple website design service.',
    priceCents: 90000,
    freelancer: otherOwner._id
  });

  const first = await bookingService.book(client._id, {
    gigId: String(gig._id),
    requestId: randomUUID()
  });

  firstTransactionId = String(first.transaction._id);

  await bookingService.book(otherClient._id, {
    gigId: String(gig._id),
    requestId: randomUUID()
  });

  await bookingService.book(otherClient._id, {
    gigId: String(otherGig._id),
    requestId: randomUUID()
  });
}, { timeout: 120000 });

after(async () => {
  await database.disconnect();
  if (mongo) await mongo.stop();
});

test('financial routes require authentication and income requires a freelancer', async () => {
  for (const path of ['/api/transactions', '/api/income']) {
    assert.equal((await request(app).get(path)).status, 401);
  }

  const denied = await get('/api/income', client);

  assert.equal(denied.status, 403);
  assert.equal(denied.body.error.code, 'FORBIDDEN');
});

test('transaction lists contain only records involving the authenticated user', async () => {
  const cases = [
    [owner, 2],
    [client, 1],
    [otherClient, 2],
    [otherOwner, 1]
  ];

  for (const [user, count] of cases) {
    const response = await get('/api/transactions', user);

    assert.equal(response.status, 200);
    assert.equal(response.body.transactions.length, count);

    for (const transaction of response.body.transactions) {
      assert.ok(
        transaction.clientId === String(user._id) ||
        transaction.freelancerId === String(user._id)
      );

      assert.equal(transaction.currency, 'ZAR');
      assert.equal(transaction.status, 'simulated');
      assert.equal(transaction.passwordHash, undefined);
      assert.equal(transaction.amountCents, undefined);
    }
  }
});

test('transaction details are private to their client and freelancer', async () => {
  const path = '/api/transactions/' + firstTransactionId;

  for (const user of [client, owner]) {
    const response = await get(path, user);

    assert.equal(response.status, 200);
    assert.equal(response.body.transaction.amount, 450.5);
  }

  for (const user of [otherClient, otherOwner]) {
    assert.equal((await get(path, user)).status, 404);
  }

  assert.equal(
    (await get('/api/transactions/invalid', client)).status,
    400
  );
});

test('income totals include only the authenticated freelancer transactions', async () => {
  const response = await get('/api/income', owner);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.income, {
    totalIncome: 901,
    currency: 'ZAR',
    bookingCount: 2,
    paymentType: 'simulated'
  });

  const other = await get('/api/income', otherOwner);

  assert.equal(other.body.income.totalIncome, 900);
  assert.equal(other.body.income.bookingCount, 1);
});

test('a freelancer without bookings receives a zero income summary', async () => {
  const response = await get('/api/income', emptyOwner);

  assert.equal(response.status, 200);
  assert.equal(response.body.income.totalIncome, 0);
  assert.equal(response.body.income.bookingCount, 0);
});

test('financial routes validate pagination and reject account overrides', async () => {
  const page = await get('/api/transactions?page=1&limit=1', owner);

  assert.equal(page.status, 200);
  assert.equal(page.body.transactions.length, 1);
  assert.equal(page.body.page, 1);
  assert.equal(page.body.limit, 1);

  const invalidPaths = [
    '/api/transactions?page=0',
    '/api/transactions?limit=101',
    '/api/transactions?page[$gt]=1',
    '/api/transactions?freelancerId=' + otherOwner._id,
    '/api/income?freelancerId=' + otherOwner._id
  ];

  for (const path of invalidPaths) {
    assert.equal((await get(path, owner)).status, 400);
  }
});

test('gig price changes and removal do not alter recorded income', async () => {
  await Gig.findByIdAndUpdate(gig._id, {
    priceCents: 99999,
    active: false
  });

  const income = await get('/api/income', owner);

  assert.equal(income.body.income.totalIncome, 901);
  assert.equal(income.body.income.bookingCount, 2);

  const transaction = await get(
    '/api/transactions/' + firstTransactionId,
    owner
  );

  assert.equal(transaction.body.transaction.amount, 450.5);
});