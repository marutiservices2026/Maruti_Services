// validate.middleware.js — validates req.body against a Zod schema before it reaches a
// controller (Section 8, 9: "All request bodies validated ... before hitting
// controllers"). On success, req.body is replaced with the parsed/coerced data.
//
// Usage: router.post('/parties/create', validate(createPartySchema), partyController.create);
import ApiError from '../utils/ApiError.js';

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return next(ApiError.badRequest('Validation failed.', errors));
  }
  req.body = result.data;
  next();
};

export default validate;
