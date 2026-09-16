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

    templateOverride: { type: String, enum: ['classic', 'modern', 'detailed'] },
  },
  { timestamps: true, strict: true }
);

// unique per company + financial year (the printed invoiceNo sequence resets each FY,
// so uniqueness must include financialYear — see Section 6's index note)
invoiceSchema.index({ company: 1, financialYear: 1, invoiceNo: 1 }, { unique: true });
invoiceSchema.index({ company: 1, buyer: 1 });
invoiceSchema.index({ company: 1, invoiceDate: 1 });

export default mongoose.model('Invoice', invoiceSchema);
