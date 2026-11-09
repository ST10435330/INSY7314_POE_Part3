const ApiError = require('../utils/ApiError');

function notFound(req, res) {
  return res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found.',
      requestId: req.requestId
    }
  });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'The server could not process the request.';

  if (error instanceof ApiError) {
    status = error.status;
    code = error.code;
    message = error.message;
  } else if (error.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'The request body must contain valid JSON.';
  } else if (error.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'The request body is too large.';
  } else if (error.code === 11000) {
    status = 409;
    code = 'CONFLICT';
    message = 'This record already exists.';
  } else if (
    ['ValidationError', 'CastError', 'StrictModeError'].includes(error.name)
  ) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'The request contains invalid input.';
  }

  return res.status(status).json({
    error: { code, message, requestId: req.requestId }
  });
}

module.exports = { notFound, errorHandler };