const fs = require('node:fs');
const path = require('node:path');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

async function startDatabase() {
  const dbPath = path.resolve(__dirname, '../data/mongo');

  fs.mkdirSync(dbPath, { recursive: true });

  const database = await MongoMemoryReplSet.create({
    binary: {
      version: '7.0.24'
    },
    instanceOpts: [
      {
        port: 27017,
        dbPath
      }
    ],
    replSet: {
      name: 'rs0',
      count: 1,
      storageEngine: 'wiredTiger',
      ip: '127.0.0.1',
      args: process.platform === 'win32' ? [] : ['--nounixsocket']
    }
  });

  console.log('HustleHub MongoDB is running.');
  console.log('Keep this terminal open while using the application.');
  console.log(
    'Connection: mongodb://127.0.0.1:27017/hustlehub?replicaSet=rs0&directConnection=true'
  );

  let stopping = false;

  async function stopDatabase() {
    if (stopping) return;
    stopping = true;

    console.log('Stopping MongoDB...');

    await database.stop({
      doCleanup: false,
      force: false
    });

    process.exit(0);
  }

  process.on('SIGINT', stopDatabase);
  process.on('SIGTERM', stopDatabase);
}

startDatabase().catch(() => {
  console.error(
    'MongoDB could not start. Check your internet connection for the first download and ensure port 27017 is free.'
  );

  process.exit(1);
});