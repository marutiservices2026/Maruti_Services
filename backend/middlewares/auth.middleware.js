// auth.middleware.js — verifies the JWT access token on the Authorization header and
// attaches { id, company, role } to req.user. Every protected route in router.js is
// mounted behind this. Combined with role.middleware.js for Admin/Accountant gating.
import jwt from 'jsonwebtoken';
import ApiError from '../utils/ApiError.js';
import { env } from '../config/env.js';

export default function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(ApiError.unauthorized('Authentication token missing.'));
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = { id: payload.sub, company: payload.company, role: payload.role };
    next();
  } catch {
    next(ApiError.unauthorized('Invalid or expired token.'));
  }
}
