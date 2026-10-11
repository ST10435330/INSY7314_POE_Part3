const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

async function authenticate(req, res, next) {
  const authorization = req.get('authorization');
  const match = authorization && /^Bearer (\S+)$/i.exec(authorization);

  if (!match) {
    return res.status(401).json({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'A valid access token is required.'
      }
    });
  }

  let claims;

  try {
    claims = jwt.verify(match[1], config.jwtSecret(), {
      algorithms: ['HS256'],
      issuer: config.jwtIssuer,
      audience: config.jwtAudience
    });

    if (
      typeof claims.sub !== 'string' ||
      !/^[a-f0-9]{24}$/i.test(claims.sub)
    ) {
      throw new Error('Invalid subject.');
    }
  } catch {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'The access token is invalid or expired.'
      }
    });
  }

  try {
    const user = await User.findById(claims.sub);

    if (!user) {
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'The access token is invalid or expired.'
        }
      });
    }

    req.user = user;
    req.auth = { ...claims, role: user.role };

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = authenticate;