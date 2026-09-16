// master.controller.js — CRUD for Tally-style master data (units, tax rates, voucher
// types, payment terms, states). Was combined with FieldConfig (per-company custom
// fields) in one file until the custom-fields subsystem was removed 2026-09-15 — it was
// never actually used (zero FieldConfig documents ever existed, customFields was `{}` on
// every real invoice) and added a lot of surface area for a single-tenant internal tool.
// See understand.md for the full removal note.
import { z } from 'zod';
import * as methods from '../methods.js';
import Master from '../models/Master.model.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const MASTER_TYPES = ['unit', 'taxRate', 'voucherType', 'paymentTerms', 'state'];

export const listMastersSchema = z.object({
  type: z.enum(MASTER_TYPES),
  includeInactive: z.boolean().optional(),
});

export const createMasterSchema = z.object({
  type: z.enum(MASTER_TYPES),
  code: z.string().min(1),
  label: z.string().min(1),
  value: z.string().optional(),
});

export const updateMasterSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).optional(),
  value: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const idSchema = z.object({ id: z.string().min(1) });

// POST /masters/list — body: { type, includeInactive? }
export const listMasters = asyncHandler(async (req, res) => {
  const filter = { company: req.user.company, type: req.body.type };
  if (!req.body.includeInactive) filter.isActive = true;

  const masters = await methods.findAll(Master, filter, { sort: { label: 1 } });
  return new ApiResponse(200, masters).send(res);
});

// POST /masters/create — client adds their own master entry, Tally-style.
export const createMasterEntry = asyncHandler(async (req, res) => {
  const existing = await methods.findOne(Master, {
    company: req.user.company,
    type: req.body.type,
    code: req.body.code,
  });
  if (existing) {
    throw ApiError.conflict(`A "${req.body.type}" master with code "${req.body.code}" already exists.`);
  }

  const master = await methods.create(Master, {
    company: req.user.company,
    type: req.body.type,
    code: req.body.code,
    label: req.body.label,
    value: req.body.value,
  });

  return new ApiResponse(201, master, 'Master entry created.').send(res);
});

// POST /masters/update — body: { id, ...fields }. type/code/company are immutable.
export const updateMasterEntry = asyncHandler(async (req, res) => {
  const { id, ...fields } = req.body;
  const existing = await methods.findOne(Master, { _id: id, company: req.user.company });
  if (!existing) throw ApiError.notFound('Master entry not found.');

  delete fields.type;
  delete fields.code;
  delete fields.company;

  const updated = await methods.updateById(Master, id, fields);
  return new ApiResponse(200, updated, 'Master entry updated.').send(res);
});

// POST /masters/delete — body: { id }
export const deleteMasterEntry = asyncHandler(async (req, res) => {
  const existing = await methods.findOne(Master, { _id: req.body.id, company: req.user.company });
  if (!existing) throw ApiError.notFound('Master entry not found.');

  await methods.deleteById(Master, req.body.id);
  return new ApiResponse(200, null, 'Master entry deleted.').send(res);
});
