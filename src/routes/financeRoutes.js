const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const rules = require('../validators/finance');
const controller = require('../controllers/financeController');

const incomeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  keyGenerator: req => String(req.user._id),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many income requests. Try again later.'
    }
  }
});

router.get(
  '/transactions',
  authenticate,
  authorize('client', 'freelancer'),
  rules.list,
  validate,
  controller.list
);

router.get(
  '/transactions/:id',
  authenticate,
  authorize('client', 'freelancer'),
  rules.id,
  validate,
  controller.get
);

router.get(
  '/income',
  authenticate,
  authorize('freelancer'),
  incomeLimiter,
  rules.income,
  validate,
  controller.income
);

module.exports = router;