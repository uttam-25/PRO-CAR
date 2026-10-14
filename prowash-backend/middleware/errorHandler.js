/**
 * Central Express error handler.
 * Must be mounted last (after all routes).
 *
 * Returns JSON:
 *   { error: string, stack?: string }
 *
 * Stack trace is included only when NODE_ENV=development.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const isDev = process.env.NODE_ENV === 'development';

  const body = { error: err.message || 'Internal Server Error' };
  if (isDev && err.stack) {
    body.stack = err.stack;
  }

  res.status(status).json(body);
}

module.exports = errorHandler;
