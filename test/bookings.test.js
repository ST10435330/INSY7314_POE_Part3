const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'booking-tests-only-secret-with-at-least-32-characters';
process.env.NODE_ENV = 'test';

const app = require('../src/app');
const config = require('../src/config');
const database = require('../src/database');
const User = require('../src/models/User');
const Gig = require('../src/models/Gig');
const Booking = require('../src/models/Booking');
const Transaction = require('../src/models/Transaction');
const bookingService = require('../src/services/bookingService');

let mongo, owner, client, outsider, gig, otherGig;
let ownerToken, clientToken, outsiderToken, bookingId, transactionId;
const requestId = randomUUID();

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

function book(body, accessToken = clientToken) {
  return request(app)
    .post('/api/bookings')
    .set('Authorization', 'Bearer ' + accessToken)
    .send(body);
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

  await database.connect(mongo.getUri('hustlehub_booking_test'));
  await Promise.all([
    User.init(),
    Gig.init(),
    Booking.init(),
    Transaction.init()
  ]);

  const passwordHash = await bcrypt.hash('SecurePass123!', 12);

  [owner, client, outsider] = await User.create([
    {
      name: 'Booking Owner',
      email: 'owner@booking.test',
      role: 'freelancer',
      passwordHash
    },
    {
      name: 'Booking Client',
      email: 'client@booking.test',
      role: 'client',
      passwordHash
    },
    {
      name: 'Other Client',
      email: 'other@booking.test',
      role: 'client',
      passwordHash
    }
  ]);

  ownerToken = token(owner);
  clientToken = token(client);
  outsiderToken = token(outsider);

  gig = await Gig.create({
    title: 'Logo design',
    description: 'A simple logo design service.',
    priceCents: 45050,
    freelancer: owner._id
  });

  otherGig = await Gig.create({
    title: 'Website design',
    description: 'A simple website design service.',
    priceCents: 60000,
    freelancer: owner._id
  });
}, { timeout: 120000 });

after(async () => {
  await database.disconnect();
  if (mongo) await mongo.stop();
});

test('booking requires authentication and the client role', async () => {
  const body = { gigId: String(gig._id), requestId };

  const anonymous = await request(app)
    .post('/api/bookings').send(body);

  assert.equal(anonymous.status, 401);

  const freelancer = await book(body, ownerToken);
  assert.equal(freelancer.status, 403);
});

test('booking rejects invalid IDs and client-supplied prices', async () => {
  const invalid = await book({ gigId: 'invalid', requestId });
  assert.equal(invalid.status, 400);

  const forged = await book({
    gigId: String(gig._id),
    requestId,
    amount: 1
  });

  assert.equal(forged.status, 400);
  assert.equal(await Booking.countDocuments(), 0);
});

test('booking records the server price and one simulated transaction', async () => {
  const response = await book({ gigId: String(gig._id), requestId });

  assert.equal(response.status, 201);
  assert.equal(response.body.booking.amount, 450.5);
  assert.equal(response.body.booking.clientId, String(client._id));
  assert.equal(response.body.booking.freelancerId, String(owner._id));
  assert.equal(response.body.booking.status, 'confirmed');
  assert.equal(response.body.transaction.status, 'simulated');
  assert.equal(response.body.transaction.amount, 450.5);

  bookingId = response.body.booking.id;
  transactionId = response.body.transaction.id;

  assert.equal(response.body.transaction.bookingId, bookingId);
  assert.equal(await Booking.countDocuments(), 1);
  assert.equal(await Transaction.countDocuments(), 1);
  assert.equal((await Gig.findById(gig._id)).bookingCount, 1);
});

test('retrying a booking does not duplicate financial records', async () => {
  const replay = await book({
    gigId: String(gig._id).toUpperCase(),
    requestId: requestId.toUpperCase()
  });

  assert.equal(replay.status, 200);
  assert.equal(replay.body.replay, true);
  assert.equal(replay.body.booking.id, bookingId);
  assert.equal(replay.body.transaction.id, transactionId);

  const conflict = await book({
    gigId: String(otherGig._id),
    requestId
  });

  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error.code, 'REQUEST_CONFLICT');
  assert.equal(await Booking.countDocuments(), 1);
  assert.equal(await Transaction.countDocuments(), 1);
});

test('only the booking client and freelancer can see its details', async () => {
  for (const accessToken of [clientToken, ownerToken]) {
    const list = await request(app)
      .get('/api/bookings')
      .set('Authorization', 'Bearer ' + accessToken);

    assert.equal(list.status, 200);
    assert.equal(list.body.bookings.length, 1);

    const detail = await request(app)
      .get('/api/bookings/' + bookingId)
      .set('Authorization', 'Bearer ' + accessToken);

    assert.equal(detail.status, 200);
    assert.equal(detail.body.booking.id, bookingId);
    assert.equal(JSON.stringify(detail.body).includes('passwordHash'), false);
  }

  const list = await request(app)
    .get('/api/bookings')
    .set('Authorization', 'Bearer ' + outsiderToken);

  assert.deepEqual(list.body.bookings, []);

  const detail = await request(app)
    .get('/api/bookings/' + bookingId)
    .set('Authorization', 'Bearer ' + outsiderToken);

  assert.equal(detail.status, 404);
});

test('a transaction failure rolls back the booking and returns a safe error', async () => {
  const original = Transaction.create;
  let response;

  try {
    Transaction.create = async () => {
      throw new Error('Deliberate storage failure');
    };

    response = await book({
      gigId: String(gig._id),
      requestId: randomUUID()
    });
  } finally {
    Transaction.create = original;
  }

  assert.equal(response.status, 500);
  assert.equal(response.body.error.code, 'INTERNAL_ERROR');
  assert.equal(
    JSON.stringify(response.body).includes('Deliberate storage failure'),
    false
  );

  assert.equal(await Booking.countDocuments(), 1);
  assert.equal(await Transaction.countDocuments(), 1);
  assert.equal((await Gig.findById(gig._id)).bookingCount, 1);
});

test('concurrent retries create only one booking and transaction', async () => {
  const body = {
    gigId: String(gig._id),
    requestId: randomUUID()
  };

  const results = await Promise.all([
    bookingService.book(client._id, body),
    bookingService.book(client._id, body)
  ]);

  assert.equal(
    String(results[0].booking._id),
    String(results[1].booking._id)
  );

  assert.equal(
    String(results[0].transaction._id),
    String(results[1].transaction._id)
  );

  assert.equal(await Booking.countDocuments(), 2);
  assert.equal(await Transaction.countDocuments(), 2);
  assert.equal((await Gig.findById(gig._id)).bookingCount, 2);
});

test('removed gigs cannot receive new bookings and old bookings remain available', async () => {
  await Gig.findByIdAndUpdate(gig._id, { active: false });

  const response = await book({
    gigId: String(gig._id),
    requestId: randomUUID()
  });

  assert.equal(response.status, 404);
  assert.equal(await Booking.countDocuments(), 2);
  assert.equal(await Transaction.countDocuments(), 2);

  const previous = await request(app)
    .get('/api/bookings/' + bookingId)
    .set('Authorization', 'Bearer ' + clientToken);

  assert.equal(previous.status, 200);
  assert.equal(previous.body.booking.amount, 450.5);
});

test('booking rate limiting returns a controlled 429 response', async () => {
  let limited;

  for (let attempt = 0; attempt < 11; attempt++) {
    const response = await book({
      gigId: String(gig._id),
      requestId
    });

    if (response.status === 429) {
      limited = response;
      break;
    }

    assert.equal(response.status, 200);
  }

  assert.ok(limited, 'Expected the booking limiter to reject repeated requests.');
  assert.equal(limited.body.error.code, 'RATE_LIMITED');
  assert.ok(limited.headers['retry-after']);
  assert.equal(await Booking.countDocuments(), 2);
  assert.equal(await Transaction.countDocuments(), 2);
});