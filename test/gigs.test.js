const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.JWT_SECRET =
  'gig-test-secret-that-is-longer-than-thirty-two-characters';

process.env.NODE_ENV = 'test';

const app = require('../src/app');
const config = require('../src/config');
const database = require('../src/database');
const User = require('../src/models/User');
const Gig = require('../src/models/Gig');

let replicaSet, owner, other;
let ownerToken, otherToken, clientToken, gigId;

const validGig = {
  title: 'Logo Design',
  description: 'Professional logo design for small businesses.',
  price: 450.50
};

function tokenFor(user) {
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

  await database.connect(replicaSet.getUri('hustlehub_gig_test'));
  await Promise.all([User.init(), Gig.init()]);

  const passwordHash = await bcrypt.hash('GigTestPass123!', 12);

  owner = await User.create({
    name: 'Gig Owner',
    email: 'owner@example.com',
    passwordHash,
    role: 'freelancer'
  });

  other = await User.create({
    name: 'Other Freelancer',
    email: 'other@example.com',
    passwordHash,
    role: 'freelancer'
  });

  const client = await User.create({
    name: 'Test Client',
    email: 'client@example.com',
    passwordHash,
    role: 'client'
  });

  ownerToken = tokenFor(owner);
  otherToken = tokenFor(other);
  clientToken = tokenFor(client);
}, { timeout: 120000 });

after(async () => {
  await database.disconnect();
  if (replicaSet) await replicaSet.stop();
});

test('blocks gig creation without authentication or with the client role', async () => {
  const anonymous = await request(app)
    .post('/api/gigs')
    .send(validGig);

  assert.equal(anonymous.status, 401);

  const client = await request(app)
    .post('/api/gigs')
    .set('Authorization', 'Bearer ' + clientToken)
    .send(validGig);

  assert.equal(client.status, 403);
});

test('allows a freelancer to create a sanitised gig with integer-cent pricing', async () => {
  const response = await request(app)
    .post('/api/gigs')
    .set('Authorization', 'Bearer ' + ownerToken)
    .send({
      ...validGig,
      title: '<b>Logo Design</b>',
      description:
        'Professional <script>alert(1)</script>logo design for small businesses.'
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.gig.title, 'Logo Design');
  assert.equal(response.body.gig.description, validGig.description);

  gigId = response.body.gig.id;

  const stored = await Gig.findById(gigId);

  assert.equal(stored.priceCents, 45050);
  assert.equal(String(stored.freelancer), String(owner._id));
});

test('allows public browsing but restricts the own-gigs list to its owner', async () => {
  const listing = await request(app).get('/api/gigs');

  assert.equal(listing.status, 200);
  assert.equal(listing.body.gigs.length, 1);
  assert.equal(listing.body.gigs[0].freelancerName, 'Gig Owner');
  assert.equal(JSON.stringify(listing.body).includes('passwordHash'), false);
  assert.equal(JSON.stringify(listing.body).includes('owner@example.com'), false);

  const detail = await request(app).get('/api/gigs/' + gigId);
  assert.equal(detail.status, 200);

  const mine = await request(app)
    .get('/api/gigs/mine')
    .set('Authorization', 'Bearer ' + ownerToken);

  assert.equal(mine.body.gigs.length, 1);

  const others = await request(app)
    .get('/api/gigs/mine')
    .set('Authorization', 'Bearer ' + otherToken);

  assert.equal(others.status, 200);
  assert.equal(others.body.gigs.length, 0);
});

test('rejects invalid prices, ownership fields, empty updates and invalid IDs', async () => {
  for (const price of [0, -1, 10.123, 'free', { $gt: 1 }]) {
    const response = await request(app)
      .post('/api/gigs')
      .set('Authorization', 'Bearer ' + ownerToken)
      .send({ ...validGig, price });

    assert.equal(response.status, 400);
  }

  const forgedOwner = await request(app)
    .post('/api/gigs')
    .set('Authorization', 'Bearer ' + ownerToken)
    .send({ ...validGig, freelancer: String(other._id) });

  assert.equal(forgedOwner.status, 400);

  const empty = await request(app)
    .patch('/api/gigs/' + gigId)
    .set('Authorization', 'Bearer ' + ownerToken)
    .send({});

  assert.equal(empty.status, 400);

  assert.equal(
    (await request(app).get('/api/gigs/not-an-id')).status,
    400
  );

  assert.equal(
    (await request(app).get('/api/gigs?limit=invalid')).status,
    400
  );

  assert.equal(
    (await request(app).get('/api/gigs?page[$gt]=1')).status,
    400
  );
});

test('prevents another freelancer from updating or deleting the gig', async () => {
  const update = await request(app)
    .patch('/api/gigs/' + gigId)
    .set('Authorization', 'Bearer ' + otherToken)
    .send({ title: 'Stolen Gig' });

  assert.equal(update.status, 404);

  const removal = await request(app)
    .delete('/api/gigs/' + gigId)
    .set('Authorization', 'Bearer ' + otherToken);

  assert.equal(removal.status, 404);

  const stored = await Gig.findById(gigId);

  assert.equal(stored.title, 'Logo Design');
  assert.equal(stored.active, true);
});

test('allows the owner to update and remove a gig while preserving its record', async () => {
  const update = await request(app)
    .patch('/api/gigs/' + gigId)
    .set('Authorization', 'Bearer ' + ownerToken)
    .send({ price: 500, title: 'Updated Logo Design' });

  assert.equal(update.status, 200);
  assert.equal(update.body.gig.price, 500);

  const removal = await request(app)
    .delete('/api/gigs/' + gigId)
    .set('Authorization', 'Bearer ' + ownerToken);

  assert.equal(removal.status, 200);

  const stored = await Gig.findById(gigId);

  assert.equal(stored.active, false);

  assert.equal(
    (await request(app).get('/api/gigs/' + gigId)).status,
    404
  );

  assert.equal(
    (await request(app).get('/api/gigs')).body.gigs.length,
    0
  );
});

test('uses the current database role instead of an old JWT role', async () => {
  await User.findByIdAndUpdate(owner._id, {
    $set: { role: 'client' }
  });

  const response = await request(app)
    .post('/api/gigs')
    .set('Authorization', 'Bearer ' + ownerToken)
    .send(validGig);

  assert.equal(response.status, 403);
});