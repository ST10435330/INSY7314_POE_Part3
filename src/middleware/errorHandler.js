function notFound(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' }
  });
}

function errorHandler(error, req, res, _next) {
  const requestId = req.requestId;
  console.error(`[${requestId}]`, error.message);
  if (error instanceof SyntaxError && error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'The request body must contain valid JSON.' }
    });
  }
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'The server could not process the request.',
      requestId
    }
  });
}

module.exports = { notFound, errorHandler };
