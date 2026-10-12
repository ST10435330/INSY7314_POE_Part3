const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

test('registration and login share the authentication rate limit', async () => {
  for (let attempt = 1; attempt <= 20; attempt++) {
    const path = attempt % 2 === 0
      ? '/api/auth/register'
      : '/api/auth/login';

    const response = await request(app).post(path).send({});

    assert.equal(
      response.status,
      400,
      'Attempt ' + attempt + ' should reach validation.'
    );

    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
    assert.ok(response.headers['ratelimit']);
    assert.ok(response.headers['ratelimit-policy']);
  }

  const blocked = await request(app)
    .post('/api/auth/login')
    .send({});

  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error.code, 'RATE_LIMITED');

  assert.equal(
    blocked.body.error.message,
    'Too many authentication attempts. Try again later.'
  );

  assert.ok(Number(blocked.headers['retry-after']) > 0);
  assert.ok(blocked.headers['ratelimit']);
  assert.ok(blocked.headers['ratelimit-policy']);
  assert.equal(blocked.body.error.stack, undefined);
});