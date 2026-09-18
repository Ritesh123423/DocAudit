/**
 * Central error handler. Keeps stack traces out of API responses while still
 * logging the full error server-side for debugging.
 */
function errorHandler(err, req, res, next) {
  console.error(err);

  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || 500;
  const message = err.publicMessage || "Something went wrong while processing your request.";

  res.status(status).json({ message });
}

/**
 * Wraps an async route handler so rejected promises are forwarded to errorHandler
 * instead of crashing the process or hanging the request.
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, asyncHandler };
