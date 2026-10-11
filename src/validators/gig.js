const { body, param, query, checkExact } = require('express-validator');
const sanitizeHtml = require('sanitize-html');

const clean = value => sanitizeHtml(value.normalize('NFKC'), {
  allowedTags: [],
  allowedAttributes: {}
}).trim();

function text(field, min, max, optional) {
  let rule = body(field);

  if (optional) rule = rule.optional();

  return rule
    .isString().withMessage(field + ' must be text.').bail()
    .customSanitizer(clean)
    .isLength({ min, max })
    .withMessage(field + ' has an invalid length.');
}

function price(optional) {
  let rule = body('price');

  if (optional) rule = rule.optional();

  return rule.custom(value =>
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 1 &&
    value <= 1000000 &&
    value === Number(value.toFixed(2))
  ).withMessage(
    'Price must be between R1 and R1,000,000 with at most two decimal places.'
  );
}

const fields = optional => [
  text('title', 3, 100, optional),
  text('description', 10, 2000, optional),
  price(optional)
];

const exactBody = {
  locations: ['body'],
  message: 'Unexpected gig fields.'
};

module.exports = {
  create: checkExact(fields(false), exactBody),

  update: [
    body().custom(value =>
      value &&
      !Array.isArray(value) &&
      Object.keys(value).length > 0
    ).withMessage('Supply at least one field to update.'),

    checkExact(fields(true), exactBody)
  ],

  id: param('id')
    .isMongoId()
    .withMessage('Invalid gig ID.'),

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
    message: 'Unexpected query fields.'
  })
};