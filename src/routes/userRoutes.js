const express = require('express');
const authenticate = require('../middleware/authenticate');
const userStore = require('../storage/userStore');

const router = express.Router();

router.get('/me', authenticate, (req, res) => {
  const user = userStore.findById(req.auth.sub);
  if (!user) {
    return res.status(404).json({
      error: { code: 'USER_NOT_FOUND', message: 'The authenticated user no longer exists.' }
    });
  }

  return res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

module.exports = router;
