// ApiError.js — standardized thrown error class (Section 10). Carries a statusCode and
// an optional field-level errors array, so validation (400), auth (401/403), not-found
// (404), conflict (409), and server (500) errors are all handled the same way through
// error.middleware.js — no scattered res.status(...) calls in controllers.
class ApiError extends Error {
  constructor(statusCode, message = 'Something went wrong', errors = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.success = false;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', errors = []) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Conflict', errors = []) {
    return new ApiError(409, message, errors);
  }

  static internal(message = 'Something went wrong') {
    return new ApiError(500, message);
  }
}

export default ApiError;
