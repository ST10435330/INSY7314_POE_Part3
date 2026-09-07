const jwt = require('jsonwebtoken');
const config = require('../config');

function authenticate(req, res, next) {
  const authorization = req.get('authorization');
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'A valid access token is required.' }
    });
  }

  try {
    const token = authorization.slice(7);
    req.auth = jwt.verify(token, config.jwtSecret(), {
      algorithms: ['HS256'],
      issuer: config.jwtIssuer,
      audience: config.jwtAudience
    });
    return next();
  } catch (_error) {
    return res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'The access token is invalid or expired.' }
    });
  }
}

module.exports = authenticate;
