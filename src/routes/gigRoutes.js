const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const rules = require('../validators/gig');
const validate = require('../middleware/validate');
const controller = require('../controllers/gigController');

router.get('/', rules.list, validate, controller.list);

router.get('/mine',
  authenticate,
  authorize('freelancer'),
  controller.mine
);

router.get('/:id', rules.id, validate, controller.get);

router.post('/',
  authenticate,
  authorize('freelancer'),
  rules.create,
  validate,
  controller.create
);

router.patch('/:id',
  authenticate,
  authorize('freelancer'),
  rules.id,
  rules.update,
  validate,
  controller.update
);

router.delete('/:id',
  authenticate,
  authorize('freelancer'),
  rules.id,
  validate,
  controller.remove
);

module.exports = router;