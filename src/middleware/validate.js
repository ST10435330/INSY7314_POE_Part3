const { validationResult } = require('express-validator');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  return res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'The request contains invalid input.',
      details: errors.array().map(({ path, msg }) => ({ field: path, message: msg }))
    }
  });
}

module.exports = validate;
