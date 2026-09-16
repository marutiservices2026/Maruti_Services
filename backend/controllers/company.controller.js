// company.controller.js — company profile CRUD and template selection (Section 16). No
// company.validator.js exists in Section 4's file tree, so (consistent with auth/master)
// the Zod schemas live inline here. (Logo/signature upload used to live here too — removed
// 2026-09-15, see understand.md: the bundled default logo already IS this company's own
// logo, and there was no fallback for a missing signature worth keeping a whole
// upload/storage path around for.)
import { z } from 'zod';
import * as methods from '../methods.js';
import Company from '../models/Company.model.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const TEMPLATES = ['classic', 'modern', 'detailed'];

export const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  tagline: z.string().optional(),
  address: z.string().min(1).optional(),
  gstin: z.string().length(15).optional(),
  stateName: z.string().min(1).optional(),
  stateCode: z.string().min(1).optional(),
  pan: z.string().optional(),
  phone: z.string().optional(),
  // Plain z.string().email() rejects '' outright — but '' is how the client signals
  // "clear this field", not an invalid address, so it must be accepted alongside real
  // emails (see CompanyProfile.jsx's save handler for the other half of this fix).
  email: z.union([z.literal(''), z.string().email()]).optional(),
  website: z.string().optional(),
  bankDetails: z
    .object({
      bankName: z.string().optional(),
      accountNo: z.string().optional(),
      branch: z.string().optional(),
      ifsc: z.string().optional(),
    })
    .optional(),
});

export const setTemplateSchema = z.object({
  companyId: z.string().optional(),
  invoiceTemplate: z.enum(TEMPLATES).optional(),
});

// POST /companies/detail — the authenticated user's own company profile
export const detail = asyncHandler(async (req, res) => {
  const company = await methods.findOne(Company, { _id: req.user.company });
  if (!company) throw ApiError.notFound('Company not found.');
  return new ApiResponse(200, company).send(res);
});

// POST /companies/update
export const update = asyncHandler(async (req, res) => {
  const updated = await methods.updateById(Company, req.user.company, req.body);
  return new ApiResponse(200, updated, 'Company updated.').send(res);
});

// POST /companies/set-template — body: { companyId, invoiceTemplate } (Section 7, 16).
// companyId is accepted for the literal request-shape spec gives, but the operation
// always targets the authenticated user's own company — a mismatched companyId is
// rejected rather than silently ignored, to fail loudly on a client bug.
export const setTemplate = asyncHandler(async (req, res) => {
  if (req.body.companyId && req.body.companyId !== req.user.company) {
    throw ApiError.forbidden('Cannot set the template for another company.');
  }

  const fields = {};
  if (req.body.invoiceTemplate) fields.invoiceTemplate = req.body.invoiceTemplate;

  const updated = await methods.updateById(Company, req.user.company, fields);
  return new ApiResponse(200, updated, 'Template preference updated.').send(res);
});
