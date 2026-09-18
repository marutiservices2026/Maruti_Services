// quotation.controller.js — pre-sale estimate CRUD + PDF + "Convert to Invoice" (Section:
// added 2026-09-17). Deliberately a separate model/controller from Invoice, not a status
// flag on it — a quotation must never consume the GST-#### sequence or appear in any sales/
// GST report until (and unless) it's explicitly converted into a real invoice.
import * as methods from '../methods.js';
import Quotation from '../models/Quotation.model.js';
import Invoice from '../models/Invoice.model.js';
import Company from '../models/Company.model.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { computeDocumentTotals, stripTransient } from '../services/documentTotals.service.js';
import { getNextDocumentNumber } from '../services/invoiceNumber.service.js';
import { amountToWords } from '../services/numberToWords.service.js';
import { renderPdf, getDefaultLogoDataUri } from '../services/pdf.service.js';

// Same unit-column collapsing rule as invoice.controller.js's commonUnitOf — only
// meaningful when every line item shares one unit.
function commonUnitOf(items) {
  const units = new Set(items.map((i) => i.unit).filter(Boolean));
  return units.size === 1 ? [...units][0] : '';
}

function safeFilenamePart(value) {
  return (
    String(value || '')
      .replace(/[\r\n"]/g, '')
      .trim() || 'separate-bill'
  );
}

// POST /quotations/create
export const create = asyncHandler(async (req, res) => {
  const { resolvedItems, gst, totalQuantity } = await computeDocumentTotals(
    req.user.company,
    req.body.buyer,
    req.body.items
  );

  const { documentNo, financialYear, seq } = await getNextDocumentNumber(
    req.user.company,
    'quotation',
    req.body.quotationDate
  );

  const quotation = await methods.create(Quotation, {
    company: req.user.company,
    buyer: req.body.buyer,
    quotationNo: documentNo,
    financialYear,
    quotationDate: req.body.quotationDate,
    deliveryNote: req.body.deliveryNote,
    modeOfPayment: req.body.modeOfPayment,
    // Same as invoice.controller.js's create: defaults to the bill's own sequence number,
    // no leading zeros (SB-0001 -> "1") — the user's explicit request, extended here to
    // match. Only a default: an explicitly typed Supplier's Ref still wins.
    supplierRef: req.body.supplierRef || String(seq),
    otherReferences: req.body.otherReferences,
    buyersOrderNo: req.body.buyersOrderNo,
    buyersOrderDate: req.body.buyersOrderDate,
    despatchDocNo: req.body.despatchDocNo,
    despatchDocDate: req.body.despatchDocDate,
    despatchedThrough: req.body.despatchedThrough,
    destination: req.body.destination,
    termsOfDelivery: req.body.termsOfDelivery,
    items: stripTransient(resolvedItems),
    taxableValue: gst.taxableValue,
    cgstRate: gst.cgstRate,
    cgstAmount: gst.cgstAmount,
    sgstRate: gst.sgstRate,
    sgstAmount: gst.sgstAmount,
    igstRate: gst.igstRate,
    igstAmount: gst.igstAmount,
    roundOff: gst.roundOff,
    totalQuantity,
    totalAmount: gst.totalAmount,
    hsnWiseBreakup: gst.hsnWiseBreakup,
    amountInWords: amountToWords(gst.totalAmount),
    taxAmountInWords: amountToWords(gst.cgstAmount + gst.sgstAmount + gst.igstAmount),
    createdBy: req.user.id,
  });

  return new ApiResponse(201, quotation, 'Separate bill created.').send(res);
});

// POST /quotations/list — body: { page, limit, from, to, party, status, search }
export const list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, from, to, party, status, search } = req.body;
  const filter = { company: req.user.company };
  if (party) filter.buyer = party;
  if (status) filter.status = status;
  if (search)
    filter.quotationNo = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  if (from || to) {
    filter.quotationDate = {};
    if (from) filter.quotationDate.$gte = new Date(from);
    if (to) filter.quotationDate.$lte = new Date(to);
  }

  const result = await methods.paginate(Quotation, filter, page, limit, {
    sort: { quotationDate: -1 },
    populate: ['buyer'],
  });
  return new ApiResponse(200, result).send(res);
});

// POST /quotations/detail — body: { id }
export const detail = asyncHandler(async (req, res) => {
  const quotation = await methods.findOne(
    Quotation,
    { _id: req.body.id, company: req.user.company },
    { populate: ['buyer', 'items.product'] }
  );
  if (!quotation) throw ApiError.notFound('Separate bill not found.');
  return new ApiResponse(200, quotation).send(res);
});

// POST /quotations/update — body: { id, ...fields }. Unlike Invoice, nothing here is
// ever "finalized" and immutable — a quotation is just an estimate until it's converted,
// at which point it's the resulting Invoice that becomes the real, tracked document.
export const update = asyncHandler(async (req, res) => {
  const { id, items, ...fields } = req.body;
  const existing = await methods.findOne(Quotation, { _id: id, company: req.user.company });
  if (!existing) throw ApiError.notFound('Separate bill not found.');

  if (existing.status === 'converted') {
    throw ApiError.forbidden(
      'This separate bill has already been converted to an invoice and cannot be edited.'
    );
  }

  delete fields.company;
  delete fields.quotationNo;
  delete fields.financialYear;
  delete fields.createdBy;
  delete fields.convertedToInvoice;

  const updateData = { ...fields };

  if (items) {
    const buyerId = fields.buyer || existing.buyer;
    const { resolvedItems, gst, totalQuantity } = await computeDocumentTotals(
      req.user.company,
      buyerId,
      items
    );

    updateData.items = stripTransient(resolvedItems);
    updateData.taxableValue = gst.taxableValue;
    updateData.cgstRate = gst.cgstRate;
    updateData.cgstAmount = gst.cgstAmount;
    updateData.sgstRate = gst.sgstRate;
    updateData.sgstAmount = gst.sgstAmount;
    updateData.igstRate = gst.igstRate;
    updateData.igstAmount = gst.igstAmount;
    updateData.roundOff = gst.roundOff;
    updateData.totalQuantity = totalQuantity;
    updateData.totalAmount = gst.totalAmount;
    updateData.hsnWiseBreakup = gst.hsnWiseBreakup;
    updateData.amountInWords = amountToWords(gst.totalAmount);
    updateData.taxAmountInWords = amountToWords(gst.cgstAmount + gst.sgstAmount + gst.igstAmount);
  }

  const updated = await methods.updateById(Quotation, id, updateData);
  return new ApiResponse(200, updated, 'Separate bill updated.').send(res);
});

// POST /quotations/delete — body: { id }. Soft delete (status: 'cancelled') — same
// reasoning as Invoice: the quotationNo already consumed a gap-free Counter sequence
// number, so it stays consistent with how every other document in this app is "deleted".
export const remove = asyncHandler(async (req, res) => {
  const existing = await methods.findOne(Quotation, {
    _id: req.body.id,
    company: req.user.company,
  });
  if (!existing) throw ApiError.notFound('Separate bill not found.');
  if (existing.status === 'converted') {
    throw ApiError.forbidden(
      'This separate bill has already been converted to an invoice and cannot be cancelled.'
    );
  }

  const updated = await methods.updateById(Quotation, req.body.id, { status: 'cancelled' });
  return new ApiResponse(200, updated, 'Separate bill cancelled.').send(res);
});

// POST /quotations/hard-delete — body: { id }. A genuine, permanent delete — added
// 2026-09-18 at the user's request, distinct from `remove` above (soft cancel). Safe in a
// way Invoice/Party/Product deletes deliberately aren't: a Quotation isn't a tax document,
// so there's no gap-free-numbering or audit-trail requirement forcing it to stick around
// once gone. Does NOT touch a linked Invoice if this one was already converted — that
// document is fully independent (Invoice has no reference back to its source quotation),
// so deleting the source record here can never affect real, tracked sales data.
export const hardDelete = asyncHandler(async (req, res) => {
  const existing = await methods.findOne(Quotation, {
    _id: req.body.id,
    company: req.user.company,
  });
  if (!existing) throw ApiError.notFound('Separate bill not found.');

  await methods.deleteById(Quotation, req.body.id);
  return new ApiResponse(200, null, 'Separate bill deleted.').send(res);
});

// POST /quotations/bulk-delete — body: { ids: [...] }. List-page multi-select delete,
// added 2026-09-18 alongside the single hardDelete above — same operation, applied to many
// at once via a single deleteMany rather than the frontend looping N individual requests.
// company: req.user.company in the filter is the only scoping guard (no per-id existence
// check first, unlike hardDelete) — deliberate: deleteMany silently ignores ids that don't
// match rather than erroring, which is the right behavior for a bulk action where a
// checkbox's underlying row may have already been removed by someone else since the list
// was loaded.
export const bulkHardDelete = asyncHandler(async (req, res) => {
  const result = await methods.deleteMany(Quotation, {
    _id: { $in: req.body.ids },
    company: req.user.company,
  });
  return new ApiResponse(
    200,
    { deletedCount: result.deletedCount },
    `${result.deletedCount} separate bill(s) deleted.`
  ).send(res);
});

// POST /quotations/convert — body: { id }. The one moment a quotation's numbers become a
// real, tracked transaction: creates an actual Invoice (its own real GST-#### number,
// fully counted in every sales/GST report from this point on) from the quotation's buyer
// and line items, then marks the quotation itself as converted and linked to it. Re-runs
// computeDocumentTotals rather than copying the quotation's stored totals verbatim — the
// underlying product rates/GST rates may have changed since the quotation was made, and an
// actual invoice must reflect current real terms, not a stale estimate.
export const convertToInvoice = asyncHandler(async (req, res) => {
  const quotation = await methods.findOne(Quotation, {
    _id: req.body.id,
    company: req.user.company,
  });
  if (!quotation) throw ApiError.notFound('Separate bill not found.');
  if (quotation.status === 'converted') {
    throw ApiError.conflict('This separate bill has already been converted to an invoice.');
  }
  if (quotation.status === 'cancelled') {
    throw ApiError.forbidden('A cancelled separate bill cannot be converted.');
  }

  const invoice = await methods.withTransaction(async (session) => {
    const { resolvedItems, gst, totalQuantity } = await computeDocumentTotals(
      req.user.company,
      quotation.buyer,
      quotation.items
    );

    const { documentNo, financialYear } = await getNextDocumentNumber(
      req.user.company,
      'invoice',
      new Date(),
      session
    );

    const created = await methods.create(
      Invoice,
      {
        company: req.user.company,
        buyer: quotation.buyer,
        invoiceNo: documentNo,
        financialYear,
        invoiceDate: new Date(),
        items: stripTransient(resolvedItems),
        taxableValue: gst.taxableValue,
        cgstRate: gst.cgstRate,
        cgstAmount: gst.cgstAmount,
        sgstRate: gst.sgstRate,
        sgstAmount: gst.sgstAmount,
        igstRate: gst.igstRate,
        igstAmount: gst.igstAmount,
        roundOff: gst.roundOff,
        totalQuantity,
        totalAmount: gst.totalAmount,
        hsnWiseBreakup: gst.hsnWiseBreakup,
        amountInWords: amountToWords(gst.totalAmount),
        taxAmountInWords: amountToWords(gst.cgstAmount + gst.sgstAmount + gst.igstAmount),
        createdBy: req.user.id,
      },
      { session }
    );

    await methods.updateById(
      Quotation,
      quotation._id,
      { status: 'converted', convertedToInvoice: created._id },
      { session }
    );

    return created;
  });

  return new ApiResponse(201, invoice, 'Separate bill converted to invoice.').send(res);
});

// POST /quotations/pdf — body: { id } — streams the generated PDF
export const downloadPdf = asyncHandler(async (req, res) => {
  const quotation = await methods.findOne(
    Quotation,
    { _id: req.body.id, company: req.user.company },
    { populate: ['buyer'] }
  );
  if (!quotation) throw ApiError.notFound('Separate bill not found.');

  const company = await methods.findOne(Company, { _id: req.user.company });
  if (!company) throw ApiError.notFound('Company not found.');

  const defaultLogoDataUri = await getDefaultLogoDataUri();

  const data = {
    quotationNo: quotation.quotationNo,
    quotationDate: quotation.quotationDate,
    deliveryNote: quotation.deliveryNote,
    modeOfPayment: quotation.modeOfPayment,
    supplierRef: quotation.supplierRef,
    otherReferences: quotation.otherReferences,
    buyersOrderNo: quotation.buyersOrderNo,
    buyersOrderDate: quotation.buyersOrderDate,
    despatchDocNo: quotation.despatchDocNo,
    despatchDocDate: quotation.despatchDocDate,
    despatchedThrough: quotation.despatchedThrough,
    destination: quotation.destination,
    termsOfDelivery: quotation.termsOfDelivery,
    companyName: company.name,
    seller: {
      name: company.name,
      address: company.address,
      gstin: company.gstin,
      stateName: company.stateName,
      stateCode: company.stateCode,
    },
    buyer: {
      name: quotation.buyer.name,
      address: quotation.buyer.address,
      gstin: quotation.buyer.gstin,
      stateName: quotation.buyer.stateName,
      stateCode: quotation.buyer.stateCode,
    },
    items: quotation.items,
    commonUnit: commonUnitOf(quotation.items),
    isInterState: quotation.igstAmount > 0,
    taxableValue: quotation.taxableValue,
    cgstRate: quotation.cgstRate,
    cgstAmount: quotation.cgstAmount,
    sgstRate: quotation.sgstRate,
    sgstAmount: quotation.sgstAmount,
    igstRate: quotation.igstRate,
    igstAmount: quotation.igstAmount,
    totalTaxAmount: quotation.cgstAmount + quotation.sgstAmount + quotation.igstAmount,
    roundOff: quotation.roundOff,
    totalQuantity: quotation.totalQuantity,
    totalAmount: quotation.totalAmount,
    amountInWords: quotation.amountInWords,
    hsnWiseBreakup: quotation.hsnWiseBreakup,
    bankDetails: company.bankDetails,
    logoUrl: defaultLogoDataUri,
    tagline: company.tagline,
    email: company.email,
    website: company.website,
    hasContactInfo: Boolean(company.email || company.website),
  };

  const pdfBuffer = await renderPdf('quotation', 'classic', data);

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${safeFilenamePart(quotation.quotationNo)}.pdf"`,
    'Content-Length': pdfBuffer.length,
  });
  res.send(pdfBuffer);
});
