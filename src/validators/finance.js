const { query, param, checkExact } = require('express-validator');

module.exports = {
  list: checkExact([
    query('page')
      .optional()
      .isString().bail()
      .isInt({ min: 1, max: 100000 })
      .withMessage('Invalid page number.'),

    query('limit')
      .optional()
      .isString().bail()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100.')
  ], {
    locations: ['query'],
    message: 'Unexpected query parameters.'
  }),

  id: param('id')
    .isMongoId()
    .withMessage('Invalid transaction ID.'),

  income: checkExact([], {
    locations: ['query'],
    message: 'Income is determined from your authenticated account.'
  })
};