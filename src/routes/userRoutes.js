const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const controller = require('../controllers/userController');

router.get('/me', authenticate, controller.me);

module.exports = router;