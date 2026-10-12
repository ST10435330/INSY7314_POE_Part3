const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

const scenarios = [
  {
    method: 'get',
    path: '/api/health',
    status: 200
  },
  {
    method: 'get',
    path: '/api/users/me',
    status: 401
  },
  {
    method: 'get',
    path: '/api/does-not-exist',
    status: 404
  },
  {
    method: 'post',
    path: '/api/auth/login',
    status: 400,
    malformed: true
  }
];

for (const scenario of scenarios) {
  test(
    'security headers remain present on ' + scenario.status + ' responses',
    async () => {
      let pending = request(app)[scenario.method](scenario.path);

      if (scenario.malformed) {
        pending = pending
          .set('Content-Type', 'application/json')
          .send('{');
      }

      const response = await pending;

      assert.equal(response.status, scenario.status);
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.equal(response.headers['x-content-type-options'], 'nosniff');
      assert.equal(response.headers['x-frame-options'], 'SAMEORIGIN');

      assert.ok(response.headers['content-security-policy']);
      assert.ok(response.headers['x-request-id']);
      assert.equal(response.headers['x-powered-by'], undefined);

      if (scenario.status !== 200) {
        assert.equal(typeof response.body.error.code, 'string');
        assert.equal(typeof response.body.error.message, 'string');
        assert.equal(response.body.error.stack, undefined);
      }
    }
  );
}