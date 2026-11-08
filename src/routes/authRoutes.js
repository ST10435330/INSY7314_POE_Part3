const express = require('express');
const { body, checkExact } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const controller = require('../controllers/authController');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many authentication attempts. Try again later.'
    }
  }
});

const emailRule = () => body('email')
  .isString().withMessage('Email must be text.').bail()
  .trim()
  .isLength({ max: 254 }).withMessage('Email address is too long.').bail()
  .isEmail().withMessage('A valid email address is required.')
  .customSanitizer(value => value.toLowerCase());

const registrationRules = [
  body('name')
    .isString().withMessage('Name must be text.').bail()
    .customSanitizer(value => value.normalize('NFKC').trim())
    .isLength({ min: 2, max: 80 })
    .withMessage('Name must contain 2 to 80 characters.')
    .matches(/^[\p{L}\p{M} .'-]+$/u)
    .withMessage('Name contains unsupported characters.'),

  emailRule(),

  body('password')
    .isString().withMessage('Password must be text.').bail()
    .isLength({ min: 12, max: 128 })
    .withMessage('Password must contain 12 to 128 characters.')
    .custom(value => Buffer.byteLength(value, 'utf8') <= 72)
    .withMessage('Password must not exceed 72 UTF-8 bytes.')
    .matches(/[a-z]/)
    .withMessage('Password must include a lowercase letter.')
    .matches(/[A-Z]/)
    .withMessage('Password must include an uppercase letter.')
    .matches(/[0-9]/)
    .withMessage('Password must include a number.')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Password must include a special character.'),

  body('role')
    .isString().bail()
    .isIn(['freelancer', 'client'])
    .withMessage('Role must be freelancer or client.')
];

const loginRules = [
  emailRule(),

  body('password')
    .isString().withMessage('Password must be text.').bail()
    .isLength({ min: 1, max: 128 })
    .withMessage('Password is required or too long.')
    .custom(value => Buffer.byteLength(value, 'utf8') <= 72)
    .withMessage('Password must not exceed 72 UTF-8 bytes.')
];

const exactFields = {
  locations: ['body'],
  message: 'Unexpected input fields.'
};

router.post('/register', authLimiter,
  checkExact(registrationRules, exactFields),
  validate,
  controller.register
);

router.post('/login', authLimiter,
  checkExact(loginRules, exactFields),
  validate,
  controller.login
);

router.post('/logout', authenticate, controller.logout);

module.exports = router;