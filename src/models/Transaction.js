const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    unique: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  freelancer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  amountCents: {
    type: Number,
    required: true,
    min: 100,
    max: 100000000,
    validate: Number.isSafeInteger
  },
  currency: {
    type: String,
    enum: ['ZAR'],
    default: 'ZAR'
  },
  status: {
    type: String,
    enum: ['simulated'],
    default: 'simulated'
  }
}, { timestamps: true, strict: 'throw' });

module.exports = mongoose.model('Transaction', transactionSchema);