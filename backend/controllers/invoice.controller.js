// invoice.controller.js — sales invoice CRUD (Section 2, 6, 7, 9). PDF generation
// (/invoices/pdf) is wired in Build Order step 8, once pdf.service.js exists.
import * as methods from '../methods.js';
import Invoice from '../models/Invoice.model.js';
import Company from '../models/Company.model.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { computeDocumentTotals, stripTransient } from '../services/documentTotals.service.js';
import {
  getNextDocumentNumber,
  getFinancialYear,
  advanceCounterPast,
} from '../services/invoiceNumber.service.js';
import { amountToWords } from '../services/numberToWords.service.js';
import { isEwayBillRequired } from '../services/ewaybillThreshold.service.js';
import { renderPdf, getDefaultLogoDataUri } from '../services/pdf.service.js';

const DECLARATION_TEXT =
  'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.';

// Financial fields Section 9 requires to stay immutable once an invoice is finalized —
// everything else (delivery/despatch metadata, e-way bill number, status) can still change.
// `invoiceNo` joined this list 2026-09-29 when manual numbering was added — changing the
// printed invoice number on a finalized invoice must go through the same "Unlock to Edit"
// gate as every other financial field (see invoice.controller.js's `unlock`), not a new
// special case.
const FINANCIAL_FIELDS = [
  'invoiceNo',
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
  return (
    String(value || '')
      .replace(/[\r\n"]/g, '')
      .trim() || 'invoice'
  );
}

// POST /invoices/create — runs gst.service + invoiceNumber.service (Section 7)
export const create = asyncHandler(async (req, res) => {
  const { resolvedItems, gst, totalQuantity } = await computeDocumentTotals(
    req.user.company,
    req.body.buyer,
    req.body.items
  );

  const invoice = await methods.withTransaction(async (session) => {
    let documentNo, financialYear, seq;

    // Manual invoice-number override (added 2026-09-29) — see FINANCIAL_FIELDS' comment and
    // invoiceNumber.service.js's advanceCounterPast for the full reasoning. Duplicate check
    // is scoped to company + financial year, same scope the (now non-unique) DB index used
    // to enforce.
    const manualInvoiceNo = req.body.invoiceNo?.trim();
    if (manualInvoiceNo) {
      financialYear = getFinancialYear(req.body.invoiceDate);
      const duplicate = await methods.findOne(
        Invoice,
        { company: req.user.company, financialYear, invoiceNo: manualInvoiceNo },
        { session }
      );
      if (duplicate && !req.body.confirmDuplicateInvoiceNo) {
        throw ApiError.conflict(
          `Invoice number "${manualInvoiceNo}" is already used by an invoice dated ` +
            `${new Date(duplicate.invoiceDate).toISOString().slice(0, 10)}. Confirm to use it ` +
            'anyway — two invoices will then share this number.',
          [],
          {
            duplicateInvoiceNo: {
              existingInvoiceId: duplicate._id,
              existingInvoiceNo: duplicate.invoiceNo,
              existingInvoiceDate: duplicate.invoiceDate,
            },
          }
        );
      }
      documentNo = manualInvoiceNo;
      // So the NEXT auto-generated invoice in this series/year never collides with this
      // hand-typed one.
      await advanceCounterPast(req.user.company, 'invoice', financialYear, manualInvoiceNo, session);
    } else {
      ({ documentNo, financialYear, seq } = await getNextDocumentNumber(
        req.user.company,
        'invoice',
        req.body.invoiceDate,
        session
      ));
    }

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
        // Defaults to the invoice number's own sequence, no leading zeros
        // (GST-0001 -> "1", GST-0025 -> "25") — the user's explicit request. Only a
        // default: an explicitly typed Supplier's Ref (the "More Fields" input in
        // InvoiceForm.jsx) still wins, since it's a real, separately-meaningful field on
        // the classic template, not purely derived data. `seq` is only produced by the
        // auto-numbering path — a manually-set invoiceNo has no such sequence to fall
        // back to, so the default is left blank rather than printing the literal string
        // "undefined".
        supplierRef: req.body.supplierRef || (seq !== undefined ? String(seq) : undefined),
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
  if (search)
    filter.invoiceNo = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
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
    { populate: ['buyer', 'items.product', 'editHistory.unlockedBy'] }
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
// financial fields, including `invoiceNo` since 2026-09-29 (Section 9) — only metadata
// (despatch details, e-way bill no, status) can still change here. This endpoint itself
// never reverts a finalized invoice to draft — the only path back is the separate, audited
// `unlock` below, which logs why before it touches anything.
export const update = asyncHandler(async (req, res) => {
  const { id, items, confirmDuplicateInvoiceNo, ...fields } = req.body;
  const existing = await methods.findOne(Invoice, { _id: id, company: req.user.company });
  if (!existing) throw ApiError.notFound('Invoice not found.');

  if (existing.status === 'finalized') {
    const attemptedKeys = Object.keys(fields).concat(items ? ['items'] : []);
    const disallowed = attemptedKeys.filter((k) => {
      if (!FINANCIAL_FIELDS.includes(k)) return false;
      // Same key present but the same value isn't a real change — lets a caller always
      // include invoiceNo in its payload (InvoiceForm.jsx does) without that alone
      // tripping the immutability guard on a finalized invoice.
      if (k === 'invoiceNo' && fields.invoiceNo === existing.invoiceNo) return false;
      return true;
    });
    if (disallowed.length > 0) {
      throw ApiError.forbidden(
        `Finalized invoices are immutable. Cannot change: ${disallowed.join(', ')}.`
      );
    }
    if (fields.status === 'draft') {
      throw ApiError.forbidden('A finalized invoice cannot be reverted to draft.');
    }
  }

  delete fields.company;
  delete fields.financialYear;
  delete fields.createdBy;

  // Manual invoice-number override on an editable (draft, or freshly-unlocked) invoice —
  // mirrors create()'s handling. A no-op re-send of the same value skips the check entirely
  // (see the immutability carve-out above — this keeps that same "not a real change" case
  // cheap here too).
  const manualInvoiceNo = fields.invoiceNo?.trim();
  if (manualInvoiceNo && manualInvoiceNo !== existing.invoiceNo) {
    const duplicate = await methods.findOne(Invoice, {
      company: req.user.company,
      financialYear: existing.financialYear,
      invoiceNo: manualInvoiceNo,
      _id: { $ne: id },
    });
    if (duplicate && !confirmDuplicateInvoiceNo) {
      throw ApiError.conflict(
        `Invoice number "${manualInvoiceNo}" is already used by an invoice dated ` +
          `${new Date(duplicate.invoiceDate).toISOString().slice(0, 10)}. Confirm to use it ` +
          'anyway — two invoices will then share this number.',
        [],
        {
          duplicateInvoiceNo: {
            existingInvoiceId: duplicate._id,
            existingInvoiceNo: duplicate.invoiceNo,
            existingInvoiceDate: duplicate.invoiceDate,
          },
        }
      );
    }
    fields.invoiceNo = manualInvoiceNo;
    await advanceCounterPast(req.user.company, 'invoice', existing.financialYear, manualInvoiceNo);
  } else {
    // Either unchanged, or blank ("don't touch it") — never write an empty invoiceNo.
    delete fields.invoiceNo;
  }

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
    updateData.ewayBillRequired = isEwayBillRequired(gst.taxableValue);
  }

  const updated = await methods.updateById(Invoice, id, updateData);
  return new ApiResponse(200, updated, 'Invoice updated.').send(res);
});

// POST /invoices/unlock — body: { id, reason? }. Admin-only (matches /invoices/delete).
// Reverts a finalized invoice back to 'draft' so its financial fields become editable again
// through the normal /invoices/update path above — but unlike simply lifting the immutability
// check, this snapshots every FINANCIAL_FIELDS value (plus the 'finalized' status itself) into
// editHistory BEFORE reverting, so what the invoice originally said is never silently lost,
// only superseded and kept visible. invoiceNo/financialYear are untouched either way, so the
// numbering sequence never gets a gap from this. Added 2026-09-29 at the user's request: a
// client finalized a bill with a genuine input mistake and had no way to correct it — the
// original hard immutability (Section 9) was working exactly as designed, it was just too
// strict for that real case. Cancel + reissue (existing /invoices/delete) remains the right
// tool when the buyer already has the incorrect copy in hand; this unlock flow is for
// catching a mistake before that happens.
export const unlock = asyncHandler(async (req, res) => {
  const existing = await methods.findOne(Invoice, { _id: req.body.id, company: req.user.company });
  if (!existing) throw ApiError.notFound('Invoice not found.');
  if (existing.status !== 'finalized') {
    throw ApiError.badRequest('Only a finalized invoice can be unlocked.');
  }

  const previousValues = FINANCIAL_FIELDS.reduce(
    (snap, key) => {
      snap[key] = existing[key];
      return snap;
    },
    { status: existing.status }
  );

  const updated = await methods.updateById(Invoice, req.body.id, {
    status: 'draft',
    $push: {
      editHistory: {
        unlockedAt: new Date(),
        unlockedBy: req.user.id,
        reason: req.body.reason,
        previousValues,
      },
    },
  });
  return new ApiResponse(200, updated, 'Invoice unlocked for editing.').send(res);
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
