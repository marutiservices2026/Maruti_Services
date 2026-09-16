// error.middleware.js — the single place that decides the HTTP response shape for every
// error in the app (Section 10). Every controller is wrapped in asyncHandler, so a
// thrown error — from a service, a Mongoose validation failure, or an explicit
// ApiError — always lands here rather than crashing the server unhandled.
import logger from '../utils/logger.js';
import ApiError from '../utils/ApiError.js';

// Normalizes any error into an ApiError so the response shape stays consistent
// regardless of where the error originated (a thrown ApiError, Mongoose validation,
// a Mongo duplicate-key error, a bad ObjectId cast, or anything unexpected).
function normalize(err) {
  if (err instanceof ApiError) return err;

  if (err.name === 'ValidationError' && err.errors) {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return new ApiError(400, 'Validation failed.', errors);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return new ApiError(409, `Duplicate value for "${field}".`, [
      { field, message: 'Already exists.' },
    ]);
  }

  if (err.name === 'CastError') {
    return new ApiError(400, `Invalid value for "${err.path}".`);
  }

  if (err.name === 'MulterError') {
    return new ApiError(400, err.message);
  }

  return new ApiError(err.statusCode || 500, err.message, err.errors || []);
}

// eslint-disable-next-line no-unused-vars
export default function errorMiddleware(err, req, res, next) {
  const error = normalize(err);

  logger.error({
    message: error.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
    userId: req.user?.id,
    company: req.user?.company,
  });

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode === 500 ? 'Something went wrong. Please try again.' : error.message,
    errors: error.errors?.length ? error.errors : undefined,
  });
}
