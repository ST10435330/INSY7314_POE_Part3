const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const rules = require('../validators/finance');
const controller = require('../controllers/financeController');

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
  rules.income,
  validate,
  controller.income
);

module.exports = router;