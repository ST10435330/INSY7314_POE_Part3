const fs = require('node:fs');
const https = require('node:https');
const app = require('./app');
const config = require('./config');

try {
  const credentials = {
    key: fs.readFileSync(config.privateKeyPath),
    cert: fs.readFileSync(config.certificatePath)
  };

  https.createServer(credentials, app).listen(config.port, () => {
    console.log(`HustleHub+ API running at https://localhost:${config.port}`);
  });
} catch (error) {
  console.error('Unable to start the secure server.');
  console.error('Run "npm run setup:cert" and confirm that .env is configured.');
  process.exit(1);
}
