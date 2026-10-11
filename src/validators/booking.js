const { body, param, checkExact } = require('express-validator');

module.exports = {
  create: checkExact([
    body('gigId')
      .isString().bail()
      .isMongoId().withMessage('Choose a valid gig.').bail()
      .customSanitizer(value => value.toLowerCase()),

    body('requestId')
      .isString().bail()
      .isUUID(4).withMessage('A UUID v4 request ID is required.').bail()
      .customSanitizer(value => value.toLowerCase())
  ], {
    locations: ['body'],
    message: 'Unexpected fields. Price and ownership are determined by the server.'
  }),

  id: param('id')
    .isMongoId()
    .withMessage('Invalid booking ID.')
};