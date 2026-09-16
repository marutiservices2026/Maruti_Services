// asyncHandler.js — wraps a controller so a thrown error or rejected promise is
// forwarded to error.middleware.js via next() — no repeated try/catch per controller
// (Section 8).
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
