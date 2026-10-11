const fs = require('node:fs');
const https = require('node:https');

const User = require('./models/User');
const app = require('./app');
const config = require('./config');
const database = require('./database');
const Gig = require('./models/Gig');

const Booking = require('./models/Booking');
const Transaction = require('./models/Transaction');

async function startServer() {
  config.jwtSecret();

  const credentials = {
    key: fs.readFileSync(config.privateKeyPath),
    cert: fs.readFileSync(config.certificatePath),
    minVersion: 'TLSv1.2'
  };

  await database.connect(config.mongodbUri);
  await User.init();
  await Gig.init();
  await Promise.all([
  Booking.init(),
  Transaction.init()
]);

  const server = https.createServer(credentials, app);

  server.on('error', async () => {
    console.error(
      'Unable to start HTTPS. Check whether port 3443 is already in use.'
    );

    await database.disconnect();
    process.exit(1);
  });

  server.listen(config.port, '127.0.0.1', () => {
    console.log(
      `HustleHub+ API running at https://localhost:${config.port}`
    );
  });

  let stopping = false;

  function shutdown() {
    if (stopping) return;
    stopping = true;

    console.log('Stopping the API...');

    server.close(async () => {
      await database.disconnect();
      process.exit(0);
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch(async () => {
  console.error(
    'Startup failed. Check .env, generate the HTTPS certificate, and ensure MongoDB is running.'
  );

  await database.disconnect();
  process.exit(1);
});