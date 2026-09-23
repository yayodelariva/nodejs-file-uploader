// Express 5 forwards rejected promises to the error handler on its own, but
// wrapping keeps the intent explicit and keeps the routes readable.
module.exports = function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
};
