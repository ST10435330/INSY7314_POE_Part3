const publicUser = require('../utils/publicUser');

exports.me = (req, res) => {
  return res.json({ user: publicUser(req.user) });
};