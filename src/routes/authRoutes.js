const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const userStore = require('../storage/userStore');
const validate = require('../middleware/validate');

const router = express.Router();
const BCRYPT_ROUNDS = 12;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts. Try again later.' }
  }
});

const registrationRules = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 80 }).withMessage('Name must contain 2 to 80 characters.')
    .matches(/^[\p{L}\p{M} .'-]+$/u).withMessage('Name contains unsupported characters.'),
  body('email')
    .trim()
    .isEmail().withMessage('A valid email address is required.')
    .normalizeEmail()
    .isLength({ max: 254 }).withMessage('Email address is too long.'),
  body('password')
    .isString()
    .isLength({ min: 12, max: 128 }).withMessage('Password must contain 12 to 128 characters.')
    .matches(/[a-z]/).withMessage('Password must include a lowercase letter.')
    .matches(/[A-Z]/).withMessage('Password must include an uppercase letter.')
    .matches(/[0-9]/).withMessage('Password must include a number.')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must include a special character.'),
  body('role')
    .isIn(['freelancer', 'client']).withMessage('Role must be freelancer or client.')
];

const loginRules = [
  body('email').trim().isEmail().withMessage('A valid email address is required.').normalizeEmail(),
  body('password').isString().notEmpty().withMessage('Password is required.')
];

router.post('/register', authLimiter, registrationRules, validate, async (req, res, next) => {
  try {
    if (userStore.findByEmail(req.body.email)) {
      return res.status(409).json({
        error: { code: 'ACCOUNT_EXISTS', message: 'An account with this email already exists.' }
      });
    }

    const passwordHash = await bcrypt.hash(req.body.password, BCRYPT_ROUNDS);
    const user = userStore.create({ ...req.body, passwordHash });
    if (!user) {
      return res.status(409).json({
        error: { code: 'ACCOUNT_EXISTS', message: 'An account with this email already exists.' }
      });
    }

    return res.status(201).json({
      message: 'User registered successfully.',
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', authLimiter, loginRules, validate, async (req, res, next) => {
  try {
    const user = userStore.findByEmail(req.body.email);
    const passwordMatches = user && await bcrypt.compare(req.body.password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' }
      });
    }

    const accessToken = jwt.sign(
      { sub: user.id, role: user.role },
      config.jwtSecret(),
      {
        algorithm: 'HS256',
        expiresIn: config.jwtExpiresIn,
        issuer: config.jwtIssuer,
        audience: config.jwtAudience
      }
    );

    return res.json({
      message: 'Login successful.',
      accessToken,
      tokenType: 'Bearer',
      expiresIn: config.jwtExpiresIn
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
