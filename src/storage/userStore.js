const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const config = require('../config');

function ensureStore() {
  fs.mkdirSync(path.dirname(config.usersFilePath), { recursive: true });
  if (!fs.existsSync(config.usersFilePath)) {
    fs.writeFileSync(config.usersFilePath, '[]\n', { mode: 0o600 });
  }
}

function readUsers() {
  ensureStore();
  const parsed = JSON.parse(fs.readFileSync(config.usersFilePath, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error('User store has an invalid format.');
  return parsed;
}

function saveUsers(users) {
  const temporaryPath = `${config.usersFilePath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(users, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporaryPath, config.usersFilePath);
}

function findByEmail(email) {
  return readUsers().find((user) => user.email === email.toLowerCase());
}

function findById(id) {
  return readUsers().find((user) => user.id === id);
}

function create({ name, email, role, passwordHash }) {
  const users = readUsers();
  const normalizedEmail = email.toLowerCase();
  if (users.some((user) => user.email === normalizedEmail)) return null;

  const user = {
    id: randomUUID(),
    name,
    email: normalizedEmail,
    role,
    passwordHash,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  saveUsers(users);
  return user;
}

function reset() {
  ensureStore();
  saveUsers([]);
}

module.exports = { findByEmail, findById, create, reset };
