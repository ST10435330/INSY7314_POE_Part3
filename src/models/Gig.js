const mongoose = require('mongoose');

const gigSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 2000
  },
  priceCents: {
    type: Number,
    required: true,
    min: 100,
    max: 100000000,
    validate: Number.isSafeInteger
  },
  freelancer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
    immutable: true
  },
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  bookingCount: {
    type: Number,
    default: 0,
    min: 0,
    validate: Number.isSafeInteger
  }
}, {
  timestamps: true,
  strict: 'throw'
});

module.exports = mongoose.model('Gig', gigSchema);