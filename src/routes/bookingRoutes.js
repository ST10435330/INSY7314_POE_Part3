const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const rules = require('../validators/booking');
const controller = require('../controllers/bookingController');

const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many booking attempts. Try again shortly.'
    }
  }
});

router.use(authenticate);

router.post(
  '/',
  authorize('client'),
  bookingLimiter,
  rules.create,
  validate,
  controller.create
);

router.get(
  '/',
  authorize('client', 'freelancer'),
  controller.list
);

router.get(
  '/:id',
  authorize('client', 'freelancer'),
  rules.id,
  validate,
  controller.get
);

module.exports = router;