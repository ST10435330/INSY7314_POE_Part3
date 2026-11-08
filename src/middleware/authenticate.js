const { createHash } = require('node:crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const RevokedToken = require('../models/RevokedToken');

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
      !Number.isInteger(claims.exp) ||
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
    const tokenDigest = createHash('sha256').update(match[1]).digest('hex');
    const [user, revoked] = await Promise.all([
      User.findById(claims.sub),
      RevokedToken.exists({ _id: tokenDigest })
    ]);

    if (!user || revoked) {
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'The access token is invalid or expired.'
        }
      });
    }

    req.user = user;
    req.auth = { ...claims, role: user.role, tokenDigest };

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = authenticate;