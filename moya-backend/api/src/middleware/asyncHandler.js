/**
 * Wraps an async Express route handler so any rejected promise is forwarded
 * to next(err) instead of causing an unhandled-rejection crash. Express 4
 * does not automatically catch errors thrown inside async handlers — this
 * utility bridges that gap without requiring an upgrade to Express 5.
 *
 * Usage:
 *   router.get("/path", asyncHandler(async (req, res) => { ... }));
 */
module.exports = function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
};
