// Invoice.model.js — sales invoice (outgoing). Field set is the reference-invoice
// breakdown from Section 2 in full: header fields, seller/buyer blocks (by ref —
// Company/Party are populated at render time), line items, tax block, and summary.
import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    description: { type: String, required: true, trim: true },
    hsnSac: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true, trim: true },
    rate: { type: Number, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

// One row per unique HSN/SAC + rate combination, for Section 2's "HSN/SAC-wise tax
// breakup table". Computed once by gst.service.js at create/update time and stored
// verbatim — line items don't persist their own gstRate, so this is the only place the
// per-rate detail survives for PDF rendering (and it stays historically accurate even
// if a linked Product's rate changes later).
const hsnBreakupSchema = new mongoose.Schema(
  {
    hsnSac: String,
    taxableValue: Number,
    cgstRate: Number,
    cgstAmount: Number,
    sgstRate: Number,
    sgstAmount: Number,
    igstRate: Number,
    igstAmount: Number,
    totalTax: Number,
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }, // seller
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },

    invoiceNo: { type: String, required: true, trim: true }, // generated via Counter, e.g. GST-0001
    financialYear: { type: String, required: true, trim: true }, // e.g. "2026-27" — see invoiceNumber.service.js
    invoiceDate: { type: Date, required: true },
    documentTitle: { type: String, default: 'Tax Invoice' },
    copyType: {
      type: String,
      enum: ['Original for Recipient', 'Duplicate for Transporter', 'Triplicate for Supplier'],
      default: 'Original for Recipient',
    },

    deliveryNote: { type: String, trim: true },
    modeOfPayment: { type: String, trim: true },
    supplierRef: { type: String, trim: true },
    otherReferences: { type: String, trim: true },
    buyersOrderNo: { type: String, trim: true },
    buyersOrderDate: { type: Date },
    despatchDocNo: { type: String, trim: true },
    despatchDocDate: { type: Date },
    despatchedThrough: { type: String, trim: true },
    destination: { type: String, trim: true },
    termsOfDelivery: { type: String, trim: true },

    items: { type: [invoiceItemSchema], required: true, validate: (v) => v.length > 0 },

    taxableValue: { type: Number, required: true },
    cgstRate: { type: Number, default: 0 },
    cgstAmount: { type: Number, default: 0 },
    sgstRate: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstRate: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    totalQuantity: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    hsnWiseBreakup: { type: [hsnBreakupSchema], default: [] },

    amountInWords: { type: String, trim: true },
    taxAmountInWords: { type: String, trim: true },

    ewayBillRequired: { type: Boolean, default: false }, // auto-set by ewaybillThreshold.service.js
    ewayBillNo: { type: String, trim: true },

    status: { type: String, enum: ['draft', 'finalized', 'cancelled'], default: 'draft' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Audit trail for the "Unlock to Edit" flow (added 2026-09-29 — invoice.controller.js's
    // unlock) — a finalized invoice can be reverted to 'draft' and re-edited (e.g. a genuine
    // mistake caught after finalizing), but every unlock snapshots the financial fields as
    // they stood at that moment here FIRST, so the invoice's original numbers are never
    // silently lost even though status/fields do change. Never edited or removed by any
    // other code path — append-only.
    editHistory: {
      type: [
        {
          unlockedAt: { type: Date, required: true },
          unlockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
          reason: { type: String, trim: true },
          // Snapshot of FINANCIAL_FIELDS (see invoice.controller.js) plus the status
          // ('finalized') at the moment of unlock — Mixed because it's a point-in-time
          // copy of fields whose own shape can evolve, not a live reference.
          previousValues: { type: mongoose.Schema.Types.Mixed, required: true },
        },
      ],
      default: [],
      _id: false,
    },

    templateOverride: { type: String, enum: ['classic', 'modern', 'detailed'] },
  },
  { timestamps: true, strict: true }
);

// Scoped per company + financial year (the printed invoiceNo sequence resets each FY) —
// kept as a plain, non-unique index for lookup speed. NOT a unique constraint since
// 2026-09-29: the auto-generated path (invoiceNumber.service.js) can never produce a
// collision on its own, but the user explicitly asked to be allowed to manually set an
// invoiceNo that duplicates an existing one, after an explicit "this number is already
// used — use it anyway?" confirmation in the UI (invoice.controller.js's create/update,
// gated on `confirmDuplicateInvoiceNo`). A hard unique index would make that confirmed
// choice fail at the DB layer regardless of the user's intent, so the integrity guarantee
// this index used to provide is now enforced at the application layer (as a warning, not a
// block) instead of the database layer. Two real invoices sharing a number is a genuine GST
// compliance risk the user was told about directly before this changed — not a bug if it
// happens, since it now requires an explicit, informed confirmation to reach that state.
invoiceSchema.index({ company: 1, financialYear: 1, invoiceNo: 1 });
invoiceSchema.index({ company: 1, buyer: 1 });
invoiceSchema.index({ company: 1, invoiceDate: 1 });

export default mongoose.model('Invoice', invoiceSchema);
