// ApiError.js — standardized thrown error class (Section 10). Carries a statusCode and
// an optional field-level errors array, so validation (400), auth (401/403), not-found
// (404), conflict (409), and server (500) errors are all handled the same way through
// error.middleware.js — no scattered res.status(...) calls in controllers.
class ApiError extends Error {
  // `meta` (added 2026-09-29) — optional structured payload for a caller that needs more
  // than a human-readable message + field errors to react correctly, e.g. the invoice
  // duplicate-number conflict (invoice.controller.js), where the frontend needs the
  // conflicting invoice's own id/number/date to build a specific "use anyway?" confirm
  // dialog rather than just showing a generic error toast. Passed through untouched by
  // error.middleware.js; omitted (undefined) for every existing caller, so this is additive
  // and doesn't change any current error response's shape.
  constructor(statusCode, message = 'Something went wrong', errors = [], meta) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.meta = meta;
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

  static conflict(message = 'Conflict', errors = [], meta) {
    return new ApiError(409, message, errors, meta);
  }

  static internal(message = 'Something went wrong') {
    return new ApiError(500, message);
  }
}

export default ApiError;
