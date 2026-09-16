// role.middleware.js — enforces Admin vs Accountant permissions at the route level
// (Section 3, 9). Must run after auth.middleware.js, which populates req.user.
//
// Usage: router.post('/parties/delete', authMiddleware, requireRole('admin'), partyController.remove);
import ApiError from '../utils/ApiError.js';

const requireRole =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action.'));
    }
    next();
  };

export default requireRole;
