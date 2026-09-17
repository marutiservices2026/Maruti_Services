// router.js — SINGLE ROUTES FILE — every route declared here.
// PROJECT CONVENTION: every route is POST — no GET/PUT/PATCH/DELETE anywhere.
// Filters, IDs, and pagination that would normally be query params or path params
// are sent in the request body instead. Each route's handler points directly to
// a controller function, mounted under /api/v1 in index.js.
import express from 'express';
import multer from 'multer';
import authMiddleware from './middlewares/auth.middleware.js';
import requireRole from './middlewares/role.middleware.js';
import validate from './middlewares/validate.middleware.js';
import { loginRateLimiter } from './middlewares/rateLimiter.middleware.js';
import * as authController from './controllers/auth.controller.js';
import * as masterController from './controllers/master.controller.js';
import * as partyController from './controllers/party.controller.js';
import * as partyValidator from './validators/party.validator.js';
import * as productController from './controllers/product.controller.js';
import * as productValidator from './validators/product.validator.js';
import * as invoiceController from './controllers/invoice.controller.js';
import * as invoiceValidator from './validators/invoice.validator.js';
import * as companyController from './controllers/company.controller.js';
import * as templateController from './controllers/template.controller.js';
import * as ewaybillController from './controllers/ewaybill.controller.js';
import * as reportController from './controllers/report.controller.js';

const router = express.Router();

// Upload middleware for e-way bill document parsing — MIME type and size validated
// (Section 9) before the file ever reaches a controller. 15MB (not the original 5MB)
// because e-way bill uploads are real phone camera photos, which routinely land in the
// 5-12MB range at full resolution — 5MB was silently rejecting real-world uploads with
// "File too large" before this was raised. (A second, tighter `uploadImage` instance used
// to exist here for logo/signature upload — removed 2026-09-15 along with that feature
// entirely, see understand.md.)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      const err = new Error('Unsupported file type. Allowed: JPEG, PNG, WebP, PDF.');
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

router.post('/auth/register', validate(authController.registerSchema), authController.register);
router.post(
  '/auth/login',
  loginRateLimiter,
  validate(authController.loginSchema),
  authController.login
);
router.post('/auth/refresh', authController.refresh);
router.post('/auth/logout', authController.logout);
router.post(
  '/auth/change-password',
  authMiddleware,
  validate(authController.changePasswordSchema),
  authController.changePassword
);

// masters (Tally-style dynamic setup — Section 6a). Custom fields (FieldConfig) used to
// live here too — removed 2026-09-15, see understand.md.
router.post(
  '/masters/list',
  authMiddleware,
  validate(masterController.listMastersSchema),
  masterController.listMasters
);
router.post(
  '/masters/create',
  authMiddleware,
  validate(masterController.createMasterSchema),
  masterController.createMasterEntry
);
router.post(
  '/masters/update',
  authMiddleware,
  validate(masterController.updateMasterSchema),
  masterController.updateMasterEntry
);
router.post(
  '/masters/delete',
  authMiddleware,
  requireRole('admin'),
  validate(masterController.idSchema),
  masterController.deleteMasterEntry
);

// parties
router.post('/parties/list', authMiddleware, validate(partyValidator.listPartySchema), partyController.list);
router.post(
  '/parties/create',
  authMiddleware,
  validate(partyValidator.createPartySchema),
  partyController.create
);
router.post(
  '/parties/update',
  authMiddleware,
  validate(partyValidator.updatePartySchema),
  partyController.update
);
router.post(
  '/parties/delete',
  authMiddleware,
  requireRole('admin'),
  validate(partyValidator.idSchema),
  partyController.remove
);

// products
router.post(
  '/products/list',
  authMiddleware,
  validate(productValidator.listProductSchema),
  productController.list
);
router.post(
  '/products/create',
  authMiddleware,
  validate(productValidator.createProductSchema),
  productController.create
);
router.post(
  '/products/update',
  authMiddleware,
  validate(productValidator.updateProductSchema),
  productController.update
);
router.post(
  '/products/delete',
  authMiddleware,
  requireRole('admin'),
  validate(productValidator.idSchema),
  productController.remove
);

// invoices (sales) — /invoices/pdf wired in Build Order step 8
router.post(
  '/invoices/create',
  authMiddleware,
  validate(invoiceValidator.createInvoiceSchema),
  invoiceController.create
);
router.post(
  '/invoices/list',
  authMiddleware,
  validate(invoiceValidator.listInvoiceSchema),
  invoiceController.list
);
router.post(
  '/invoices/detail',
  authMiddleware,
  validate(invoiceValidator.idSchema),
  invoiceController.detail
);
router.post(
  '/invoices/update',
  authMiddleware,
  validate(invoiceValidator.updateInvoiceSchema),
  invoiceController.update
);
router.post(
  '/invoices/delete',
  authMiddleware,
  requireRole('admin'),
  validate(invoiceValidator.idSchema),
  invoiceController.remove
);

router.post('/invoices/pdf', authMiddleware, validate(invoiceValidator.idSchema), invoiceController.downloadPdf);

// company profile + template selection (Section 16)
router.post('/companies/detail', authMiddleware, companyController.detail);
router.post(
  '/companies/update',
  authMiddleware,
  requireRole('admin'),
  validate(companyController.updateCompanySchema),
  companyController.update
);
router.post(
  '/companies/set-template',
  authMiddleware,
  requireRole('admin'),
  validate(companyController.setTemplateSchema),
  companyController.setTemplate
);
router.post(
  '/templates/list',
  authMiddleware,
  validate(templateController.listTemplatesSchema),
  templateController.list
);

// e-way bills (Section 1, 14 — manual entry only, no direct GSTN API integration)
router.post(
  '/ewaybills/list',
  authMiddleware,
  validate(ewaybillController.listEwayBillSchema),
  ewaybillController.list
);
router.post(
  '/ewaybills/create',
  authMiddleware,
  validate(ewaybillController.createEwayBillSchema),
  ewaybillController.create
);
router.post(
  '/ewaybills/parse',
  authMiddleware,
  upload.single('file'),
  ewaybillController.parseDocument
);

// reports
router.post(
  '/reports/sales-register',
  authMiddleware,
  validate(reportController.dateRangeSchema),
  reportController.salesRegister
);
router.post(
  '/reports/gst-summary',
  authMiddleware,
  validate(reportController.dateRangeSchema),
  reportController.gstSummary
);

export default router;
