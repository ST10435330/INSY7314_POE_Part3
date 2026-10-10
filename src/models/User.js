const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 80
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254
  },
  passwordHash: {
    type: String,
    required: true,
    select: false,
    match: /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/
  },
  role: {
    type: String,
    required: true,
    enum: ['client', 'freelancer', 'admin']
  }
}, {
  timestamps: true,
  strict: 'throw'
});

module.exports = mongoose.model('User', userSchema);