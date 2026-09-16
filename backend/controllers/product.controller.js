// product.controller.js — product CRUD (Section 6, 7)
import * as methods from '../methods.js';
import Product from '../models/Product.model.js';
import Master from '../models/Master.model.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

// unit/gstRate are refs into Master — confirms the id is real, company-owned, and of the
// right Master.type before it's allowed onto a Product (a bad ref here would silently
// break invoice tax calculation later).
async function assertMaster(companyId, id, type, label) {
  const master = await methods.findOne(Master, { _id: id, company: companyId, type });
  if (!master) throw ApiError.badRequest(`Invalid ${label}.`);
  return master;
}

// POST /products/list — body: { page, limit, search, category }
export const list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, category } = req.body;
  const filter = { company: req.user.company, isActive: true };
  if (category) filter.category = category;
  if (search) filter.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

  const result = await methods.paginate(Product, filter, page, limit, {
    sort: { name: 1 },
    populate: ['unit', 'gstRate'],
  });
  return new ApiResponse(200, result).send(res);
});

// POST /products/create
export const create = asyncHandler(async (req, res) => {
  await assertMaster(req.user.company, req.body.unit, 'unit', 'unit');
  await assertMaster(req.user.company, req.body.gstRate, 'taxRate', 'GST rate');

  const product = await methods.create(Product, {
    company: req.user.company,
    name: req.body.name,
    hsnSac: req.body.hsnSac,
    unit: req.body.unit,
    defaultRate: req.body.defaultRate,
    gstRate: req.body.gstRate,
    category: req.body.category,
  });

  return new ApiResponse(201, product, 'Product created.').send(res);
});

// POST /products/update — body: { id, ...fields }
export const update = asyncHandler(async (req, res) => {
  const { id, ...fields } = req.body;
  const existing = await methods.findOne(Product, { _id: id, company: req.user.company });
  if (!existing) throw ApiError.notFound('Product not found.');

  if (fields.unit) await assertMaster(req.user.company, fields.unit, 'unit', 'unit');
  if (fields.gstRate) await assertMaster(req.user.company, fields.gstRate, 'taxRate', 'GST rate');

  delete fields.company;

  const updated = await methods.updateById(Product, id, fields);
  return new ApiResponse(200, updated, 'Product updated.').send(res);
});

// POST /products/delete — body: { id }. Soft-delete: Invoice line items reference
// products by ObjectId, so hard-deleting would leave historical invoices pointing at
// nothing.
export const remove = asyncHandler(async (req, res) => {
  const existing = await methods.findOne(Product, { _id: req.body.id, company: req.user.company });
  if (!existing) throw ApiError.notFound('Product not found.');

  await methods.updateById(Product, req.body.id, { isActive: false });
  return new ApiResponse(200, null, 'Product deleted.').send(res);
});
