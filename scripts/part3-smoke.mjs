import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.argv[2] || 'http://localhost:8080';
const api = new URL(process.argv[3] || '/api/', base);
const suffix = randomUUID().slice(0, 12);
const password = 'DemoOnly!2026Pass';

async function call(path, status, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(new URL(path, api), options);
  const requestId = response.headers.get('x-request-id');
  assert.equal(response.status, status, method + ' ' + path + ' (' + requestId + ')');
  assert.ok(requestId, 'API response must have a request ID');
  return response.status === 204 ? undefined : response.json();
}

const page = await fetch(base);
assert.equal(page.status, 200);
assert.match(await page.text(), /HustleHub\+/);
if (api.origin === new URL(base).origin) {
  assert.match(page.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
}
assert.deepEqual(await call('ready', 200), { status: 'ready' });
console.log('PASS Frontend, API and MongoDB are reachable');

async function register(role, name) {
  const email = role + '-' + suffix + '@example.com';
  await call('auth/register', 201, { method: 'POST', body: { name, email, password, role } });
  return { email, password };
}

async function login(credentials) {
  const response = await call('auth/login', 200, { method: 'POST', body: credentials });
  return response.accessToken;
}

const freelancer = await register('freelancer', 'Demo Freelancer');
const client = await register('client', 'Demo Client');
await call('auth/login', 401, { method: 'POST', body: { ...client, password: 'WrongPass123!' } });
const ownerToken = await login(freelancer);
const clientToken = await login(client);
console.log('PASS Freelancer and client authenticate; wrong password is rejected');

const { gig } = await call('gigs', 201, {
  method: 'POST', token: ownerToken,
  body: { title: 'Brand Design Package', description: 'A simulated marketplace design project.', price: 1000 }
});
const bookingInput = { gigId: gig.id, requestId: randomUUID() };
const bookingOptions = { method: 'POST', token: clientToken, body: bookingInput };
const result = await call('bookings', 201, bookingOptions);
const replay = await call('bookings', 200, bookingOptions);
assert.equal(result.transaction.id, replay.transaction.id);
const { transactions } = await call('transactions', 200, { token: clientToken });
assert.equal(transactions.length, 1);
assert.equal(transactions[0].bookingId, result.booking.id);
assert.equal(transactions[0].status, 'simulated');
console.log('PASS Gig created, booking confirmed and exactly one simulated transaction recorded');

await call('income', 403, { token: clientToken });
const { income, taxEstimate } = await call('income', 200, { token: ownerToken });
assert.equal(income.totalIncome, 1000);
assert.equal(taxEstimate.estimatedTax, 200);
assert.equal(taxEstimate.afterEstimatedTax, 800);
for (let attempt = 1; attempt < 30; attempt++) {
  await call('income', 200, { token: ownerToken });
}
const limited = await call('income', 429, { token: ownerToken });
assert.equal(limited.error.code, 'RATE_LIMITED');
console.log('PASS R1,000 gross, R200 estimated tax, R800 after estimate; client receives 403 and income burst receives 429');

await call('auth/logout', 204, { method: 'POST', token: ownerToken });
await call('users/me', 401, { token: ownerToken });
console.log('PASS Logout invalidates the previous bearer token');
