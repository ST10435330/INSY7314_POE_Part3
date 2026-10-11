const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const publicUser = require('../utils/publicUser');

const BCRYPT_ROUNDS = 12;
const dummyHash = bcrypt.hashSync(
  'dummy-password-for-login-timing',
  BCRYPT_ROUNDS
);

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await User.create({
      name,
      email,
      passwordHash,
      role
    });

    return res.status(201).json({
      message: 'User registered successfully.',
      user: publicUser(user)
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: {
          code: 'ACCOUNT_EXISTS',
          message: 'An account with this email already exists.'
        }
      });
    }

    return next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email })
      .select('+passwordHash');

    const matches = await bcrypt.compare(
      req.body.password,
      user ? user.passwordHash : dummyHash
    );

    if (!user || !matches) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email or password is incorrect.'
        }
      });
    }

    const accessToken = jwt.sign(
      { sub: String(user._id), role: user.role },
      config.jwtSecret(),
      {
        algorithm: 'HS256',
        expiresIn: config.jwtExpiresIn,
        issuer: config.jwtIssuer,
        audience: config.jwtAudience
      }
    );

    return res.json({
      message: 'Login successful.',
      accessToken,
      tokenType: 'Bearer',
      expiresIn: config.jwtExpiresIn,
      user: publicUser(user)
    });
  } catch (error) {
    return next(error);
  }
};