// invoice.controller.js — sales invoice CRUD (Section 2, 6, 7, 9). PDF generation
// (/invoices/pdf) is wired in Build Order step 8, once pdf.service.js exists.
import * as methods from '../methods.js';
import Invoice from '../models/Invoice.model.js';
import Company from '../models/Company.model.js';
import Party from '../models/Party.model.js';
import Product from '../models/Product.model.js';
import Master from '../models/Master.model.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { computeGst } from '../services/gst.service.js';
import { getNextDocumentNumber } from '../services/invoiceNumber.service.js';
import { amountToWords } from '../services/numberToWords.service.js';
import { isEwayBillRequired } from '../services/ewaybillThreshold.service.js';
import { renderPdf, getDefaultLogoDataUri } from '../services/pdf.service.js';

const DECLARATION_TEXT =
  'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.';

// Financial fields Section 9 requires to stay immutable once an invoice is finalized —
// everything else (delivery/despatch metadata, e-way bill number, status) can still change.
const FINANCIAL_FIELDS = [
  'items',
  'buyer',
  'invoiceDate',
  'taxableValue',
  'cgstRate',
  'cgstAmount',
  'sgstRate',
  'sgstAmount',
  'igstRate',
  'igstAmount',
  'roundOff',
  'totalQuantity',
  'totalAmount',
  'amountInWords',
  'taxAmountInWords',
  'hsnWiseBreakup',
];

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Resolves each incoming line item into its persisted shape, plus a transient _gstRate
// used only for computeGst(). amount is always server-recomputed (quantity * rate) —
// never trust client math for money. gstRate: for product-linked items, pulled from
// that Product's Master:taxRate entry (ignoring any client-supplied gstRate for that
// item); for manual/custom lines, the client must supply it directly.
async function resolveItems(companyId, rawItems) {
  const resolved = [];
  for (const item of rawItems) {
    let gstRate = item.gstRate;

    if (item.product) {
      const product = await methods.findOne(Product, { _id: item.product, company: companyId });
      if (!product) throw ApiError.badRequest(`Product not found: ${item.product}`);
      const taxRateMaster = await methods.findOne(Master, { _id: product.gstRate, company: companyId });
      gstRate = Number(taxRateMaster?.value) || 0;
    }

    if (gstRate === undefined || gstRate === null) {
      throw ApiError.badRequest(
        `gstRate is required for line item "${item.description}" when no product is referenced.`
      );
    }

    const amount = round2(item.quantity * item.rate);

    resolved.push({
      product: item.product,
      description: item.description,
      hsnSac: item.hsnSac,
      quantity: item.quantity,
      unit: item.unit,
      rate: item.rate,
      amount,
      _gstRate: gstRate,
    });
  }
  return resolved;
}

function stripTransient(items) {
  return items.map(({ _gstRate, ...rest }) => rest); // eslint-disable-line no-unused-vars
}

// The reference Classic template shows one unit next to the total quantity (e.g.
// "175.00 kg") — only meaningful when every line item shares the same unit.
function commonUnitOf(items) {
  const units = new Set(items.map((i) => i.unit).filter(Boolean));
  return units.size === 1 ? [...units][0] : '';
}

// A Content-Disposition header value rejects control characters outright — a stray
// newline throws Node's ERR_INVALID_CHAR rather than being silently stripped, taking the
// whole PDF download down with a 500. This actually happened once to a real invoice (a
// stored invoiceNo somehow picked up a trailing "\n" — root cause never pinned down, since
// invoiceNo is server-generated and schema-trimmed, so it must have entered through a
// write path that bypasses Mongoose setters). Sanitize defensively here regardless of how
// a bad value might get into invoiceNo in the future — this is the actual crash guard, not
// a hypothetical one.
function safeFilenamePart(value) {
  return String(value || '').replace(/[\r\n"]/g, '').trim() || 'invoice';
}

async function computeInvoiceTotals(companyId, buyerId, items) {
  const company = await methods.findOne(Company, { _id: companyId });
  if (!company) throw ApiError.notFound('Company not found.');

  const buyer = await methods.findOne(Party, { _id: buyerId, company: companyId });
  if (!buyer) throw ApiError.badRequest('Buyer not found.');
  if (buyer.type !== 'buyer' && buyer.type !== 'both') {
    throw ApiError.badRequest('Selected party is not marked as a buyer.');
  }

  const resolvedItems = await resolveItems(companyId, items);
  const gst = computeGst({
    items: resolvedItems.map((i) => ({ hsnSac: i.hsnSac, amount: i.amount, gstRate: i._gstRate })),
    sellerStateCode: company.stateCode,
    buyerStateCode: buyer.stateCode,
  });

  return { resolvedItems, gst, totalQuantity: resolvedItems.reduce((sum, i) => sum + i.quantity, 0) };
}

// POST /invoices/create — runs gst.service + invoiceNumber.service (Section 7)
export const create = asyncHandler(async (req, res) => {
  const { resolvedItems, gst, totalQuantity } = await computeInvoiceTotals(
    req.user.company,
    req.body.buyer,
    req.body.items
  );

  const invoice = await methods.withTransaction(async (session) => {
    const { documentNo, financialYear } = await getNextDocumentNumber(
      req.user.company,
      'invoice',
      req.body.invoiceDate,
      session
    );

    return methods.create(
      Invoice,
      {
        company: req.user.company,
        buyer: req.body.buyer,
        invoiceNo: documentNo,
        financialYear,
        invoiceDate: req.body.invoiceDate,
        documentTitle: req.body.documentTitle,
        copyType: req.body.copyType,
        deliveryNote: req.body.deliveryNote,
        modeOfPayment: req.body.modeOfPayment,
        supplierRef: req.body.supplierRef,
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
        ewayBillRequired: isEwayBillRequired(gst.taxableValue),
        status: 'draft',
        createdBy: req.user.id,
        templateOverride: req.body.templateOverride,
      },
      { session }
    );
  });

  return new ApiResponse(201, invoice, 'Invoice created.').send(res);
});

// POST /invoices/list — body: { page, limit, from, to, party, status }
export const list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, from, to, party, product, status, search } = req.body;
  const filter = { company: req.user.company };
  if (party) filter.buyer = party;
  if (product) filter['items.product'] = product;
  if (status) filter.status = status;
  // Matches the same "search by name" pattern party.controller.js/product.controller.js
  // use — invoiceNo is the one thing a user reliably knows when hunting for an invoice on
  // a list with no other lookup (Invoices had no search at all before this).
  if (search) filter.invoiceNo = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  if (from || to) {
    filter.invoiceDate = {};
    if (from) filter.invoiceDate.$gte = new Date(from);
    if (to) filter.invoiceDate.$lte = new Date(to);
  }

  const result = await methods.paginate(Invoice, filter, page, limit, {
    sort: { invoiceDate: -1 },
    populate: ['buyer'],
  });
  return new ApiResponse(200, result).send(res);
});

// POST /invoices/detail — body: { id }
export const detail = asyncHandler(async (req, res) => {
  const invoice = await methods.findOne(
    Invoice,
    { _id: req.body.id, company: req.user.company },
    { populate: ['buyer', 'items.product'] }
  );
  if (!invoice) throw ApiError.notFound('Invoice not found.');
  return new ApiResponse(200, invoice).send(res);
});

// POST /invoices/pdf — body: { id } — streams the generated PDF (Section 7, 16)
export const downloadPdf = asyncHandler(async (req, res) => {
  const invoice = await methods.findOne(
    Invoice,
    { _id: req.body.id, company: req.user.company },
    { populate: ['buyer'] }
  );
  if (!invoice) throw ApiError.notFound('Invoice not found.');

  const company = await methods.findOne(Company, { _id: req.user.company });
  if (!company) throw ApiError.notFound('Company not found.');

  const defaultLogoDataUri = await getDefaultLogoDataUri();

  const data = {
    documentTitle: invoice.documentTitle,
    // The printed PDF always contains both statutory copies on separate pages, not just
    // the single invoice.copyType stored on the document — see classic.template.html's
    // {{#each copies}} loop. invoice.copyType itself is no longer read for that template.
    copies: ['Original for Recipient', 'Duplicate for Transporter'],
    // modern/detailed templates were never updated to the multi-copy loop (only classic
    // was, and only classic is in active use) — they still read a single {{copyType}}.
    // Keep supplying it so picking either of those templates doesn't silently render an
    // empty copy-type label; first entry of `copies` above is the reasonable single value.
    copyType: 'Original for Recipient',
    invoiceNo: invoice.invoiceNo,
    invoiceDate: invoice.invoiceDate,
    deliveryNote: invoice.deliveryNote,
    modeOfPayment: invoice.modeOfPayment,
    supplierRef: invoice.supplierRef,
    otherReferences: invoice.otherReferences,
    buyersOrderNo: invoice.buyersOrderNo,
    buyersOrderDate: invoice.buyersOrderDate,
    despatchDocNo: invoice.despatchDocNo,
    despatchDocDate: invoice.despatchDocDate,
    despatchedThrough: invoice.despatchedThrough,
    destination: invoice.destination,
    termsOfDelivery: invoice.termsOfDelivery,
    companyName: company.name,
    seller: {
      name: company.name,
      address: company.address,
      gstin: company.gstin,
      stateName: company.stateName,
      stateCode: company.stateCode,
    },
    buyer: {
      name: invoice.buyer.name,
      address: invoice.buyer.address,
      gstin: invoice.buyer.gstin,
      stateName: invoice.buyer.stateName,
      stateCode: invoice.buyer.stateCode,
    },
    items: invoice.items,
    commonUnit: commonUnitOf(invoice.items),
    isInterState: invoice.igstAmount > 0,
    taxableValue: invoice.taxableValue,
    cgstRate: invoice.cgstRate,
    cgstAmount: invoice.cgstAmount,
    sgstRate: invoice.sgstRate,
    sgstAmount: invoice.sgstAmount,
    igstRate: invoice.igstRate,
    igstAmount: invoice.igstAmount,
    totalTaxAmount: invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount,
    roundOff: invoice.roundOff,
    totalQuantity: invoice.totalQuantity,
    totalAmount: invoice.totalAmount,
    amountInWords: invoice.amountInWords,
    hsnWiseBreakup: invoice.hsnWiseBreakup,
    taxAmountInWords: invoice.taxAmountInWords,
    pan: company.pan,
    bankDetails: company.bankDetails,
    declarationText: DECLARATION_TEXT,
    // Logo/signature upload was removed 2026-09-15 (see understand.md) — every invoice now
    // renders with the bundled brand mark; there is no signature image slot anymore.
    logoUrl: defaultLogoDataUri,
    tagline: company.tagline,
    // Phone number and the "Thank you for your business!" badge were deliberately
    // dropped from the PDF footer's contact band at the user's request — only email/
    // website remain, so hasContactInfo must match (a company with only a phone number
    // set would otherwise render an empty dark band with nothing in it).
    email: company.email,
    website: company.website,
    hasContactInfo: Boolean(company.email || company.website),
  };

  const templateKey = invoice.templateOverride || company.invoiceTemplate || 'classic';
  const pdfBuffer = await renderPdf('invoice', templateKey, data);

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${safeFilenamePart(invoice.invoiceNo)}.pdf"`,
    'Content-Length': pdfBuffer.length,
  });
  res.send(pdfBuffer);
});

// POST /invoices/update — body: { id, ...fields }. Finalized invoices are immutable for
// financial fields (Section 9) — only metadata (despatch details, e-way bill no, status)
// can still change, and a finalized invoice can never be reverted to draft.
export const update = asyncHandler(async (req, res) => {
  const { id, items, ...fields } = req.body;
  const existing = await methods.findOne(Invoice, { _id: id, company: req.user.company });
  if (!existing) throw ApiError.notFound('Invoice not found.');

  if (existing.status === 'finalized') {
    const attemptedKeys = Object.keys(fields).concat(items ? ['items'] : []);
    const disallowed = attemptedKeys.filter((k) => FINANCIAL_FIELDS.includes(k));
    if (disallowed.length > 0) {
      throw ApiError.forbidden(`Finalized invoices are immutable. Cannot change: ${disallowed.join(', ')}.`);
    }
    if (fields.status === 'draft') {
      throw ApiError.forbidden('A finalized invoice cannot be reverted to draft.');
    }
  }

  delete fields.company;
  delete fields.invoiceNo;
  delete fields.financialYear;
  delete fields.createdBy;

  const updateData = { ...fields };

  if (items) {
    const buyerId = fields.buyer || existing.buyer;
    const { resolvedItems, gst, totalQuantity } = await computeInvoiceTotals(
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
    updateData.ewayBillRequired = isEwayBillRequired(gst.taxableValue);
  }

  const updated = await methods.updateById(Invoice, id, updateData);
  return new ApiResponse(200, updated, 'Invoice updated.').send(res);
});

// POST /invoices/delete — body: { id }. Soft delete/cancel only (Section 7) — never
// hard-delete, since invoiceNo already consumed a Counter sequence number and hard
// deletion would leave a gap (Section 9: numbering must stay gap-free).
export const remove = asyncHandler(async (req, res) => {
  const existing = await methods.findOne(Invoice, { _id: req.body.id, company: req.user.company });
  if (!existing) throw ApiError.notFound('Invoice not found.');

  const updated = await methods.updateById(Invoice, req.body.id, { status: 'cancelled' });
  return new ApiResponse(200, updated, 'Invoice cancelled.').send(res);
});
