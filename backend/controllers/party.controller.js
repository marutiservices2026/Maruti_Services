// party.controller.js — buyer/supplier CRUD (Section 6, 7)
import * as methods from '../methods.js';
import Party from '../models/Party.model.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

// POST /parties/list — body: { page, limit, search, type }
export const list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, type } = req.body;
  const filter = { company: req.user.company, isActive: true };
  if (type) filter.type = type;
  if (search) filter.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

  const result = await methods.paginate(Party, filter, page, limit, { sort: { name: 1 } });
  return new ApiResponse(200, result).send(res);
});

// POST /parties/create
export const create = asyncHandler(async (req, res) => {
  const party = await methods.create(Party, {
    company: req.user.company,
    name: req.body.name,
    address: req.body.address,
    gstin: req.body.gstin,
    stateName: req.body.stateName,
    stateCode: req.body.stateCode,
    type: req.body.type,
    contactInfo: req.body.contactInfo,
  });

  return new ApiResponse(201, party, 'Party created.').send(res);
});

// POST /parties/update — body: { id, ...fields }
export const update = asyncHandler(async (req, res) => {
  const { id, ...fields } = req.body;
  const existing = await methods.findOne(Party, { _id: id, company: req.user.company });
  if (!existing) throw ApiError.notFound('Party not found.');

  delete fields.company;

  const updated = await methods.updateById(Party, id, fields);
  return new ApiResponse(200, updated, 'Party updated.').send(res);
});

// POST /parties/delete — body: { id }. Soft-delete: Invoice.buyer references parties by
// ObjectId, so hard-deleting would leave historical invoices pointing at nothing.
export const remove = asyncHandler(async (req, res) => {
  const existing = await methods.findOne(Party, { _id: req.body.id, company: req.user.company });
  if (!existing) throw ApiError.notFound('Party not found.');

  await methods.updateById(Party, req.body.id, { isActive: false });
  return new ApiResponse(200, null, 'Party deleted.').send(res);
});
