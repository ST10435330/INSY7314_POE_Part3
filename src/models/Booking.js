const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  gig: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Gig',
    required: true
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
  gigTitle: {
    type: String,
    required: true,
    maxlength: 100
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
    enum: ['confirmed'],
    default: 'confirmed'
  },
  requestId: {
    type: String,
    required: true,
    minlength: 36,
    maxlength: 36
  }
}, { timestamps: true, strict: 'throw' });

bookingSchema.index({ client: 1, requestId: 1 }, { unique: true });

module.exports = mongoose.model('Booking', bookingSchema);