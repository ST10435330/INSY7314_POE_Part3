const mongoose = require('mongoose');

mongoose.set('strictQuery', true);
mongoose.set('sanitizeFilter', true);

mongoose.connection.on('error', () => {
  console.error('A MongoDB connection error occurred.');
});

async function connect(uri) {
  if (!uri) {
    throw new Error('MONGODB_URI must be configured.');
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000
  });

  const status = await mongoose.connection.db
    .admin()
    .command({ hello: 1 });

  if (!status.setName && status.msg !== 'isdbgrid') {
    await mongoose.disconnect();

    throw new Error(
      'A MongoDB replica set is required for booking transactions.'
    );
  }

  console.log('Connected to MongoDB.');
}

async function isReady() {
  if (mongoose.connection.readyState !== 1) return false;

  try {
    const status = await mongoose.connection.db.admin()
      .command({ hello: 1 }, { timeoutMS: 2000 });
    return status.isWritablePrimary === true || status.msg === 'isdbgrid';
  } catch {
    return false;
  }
}

async function disconnect() {
  await mongoose.disconnect();
}

module.exports = { connect, disconnect, isReady };