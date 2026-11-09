const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');

const User = require('./models/User');
const app = require('./app');
const config = require('./config');
const database = require('./database');
const Gig = require('./models/Gig');

const Booking = require('./models/Booking');
const Transaction = require('./models/Transaction');
const RevokedToken = require('./models/RevokedToken');
const audit = require('./utils/audit');

async function startServer() {
  config.jwtSecret();

  const credentials = config.behindProxy ? null : {
    key: fs.readFileSync(config.privateKeyPath),
    cert: fs.readFileSync(config.certificatePath),
    minVersion: 'TLSv1.2'
  };

  await database.connect(config.mongodbUri);
  await Promise.all([User.init(), Gig.init(), Booking.init(), Transaction.init(), RevokedToken.init()]);

  const server = credentials ? https.createServer(credentials, app) : http.createServer(app);

  server.on('error', async () => {
    audit('api.listen_failed', { port: config.port }, 'error');

    await database.disconnect();
    process.exit(1);
  });

  const host = config.behindProxy ? '0.0.0.0' : '127.0.0.1';
  server.listen(config.port, host, () => {
    audit('api.started', { port: config.port, transport: credentials ? 'https' : 'http' });
  });

  let stopping = false;

  function shutdown() {
    if (stopping) return;
    stopping = true;

    audit('api.stopping', {});

    server.close(async () => {
      await database.disconnect();
      process.exit(0);
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch(async () => {
  audit('api.startup_failed', {}, 'error');

  await database.disconnect();
  process.exit(1);
});
