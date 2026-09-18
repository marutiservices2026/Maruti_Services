// Quotation.model.js — pre-sale estimate/proforma, deliberately separate from Invoice
// (Section: added 2026-09-17). Not a tax document: doesn't consume the GST-#### invoice
// sequence, and is intentionally excluded from every sales/GST report — those exist to
// report real completed sales, and a quotation, by definition, isn't one yet. Becomes a
// real, fully-tracked Invoice only via the explicit "Convert to Invoice" action
// (quotation.controller.js's `convertToInvoice`), which is the one moment a quotation's
// numbers become a real transaction.
import mongoose from 'mongoose';

const quotationItemSchema = new mongoose.Schema(
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

const quotationHsnBreakupSchema = new mongoose.Schema(
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

const quotationSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },

    quotationNo: { type: String, required: true, trim: true }, // generated via Counter, e.g. SB-0001
    financialYear: { type: String, required: true, trim: true },
    quotationDate: { type: Date, required: true },

    // Same reference-field set as Invoice.model.js, added 2026-09-17 at the user's request
    // to match the real invoice's header layout/richness — informational fields only, no
    // GST/legal significance of their own, so mirroring them here doesn't affect this
    // model's core distinction from Invoice (see file header comment).
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

    items: { type: [quotationItemSchema], required: true, validate: (v) => v.length > 0 },

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
    hsnWiseBreakup: { type: [quotationHsnBreakupSchema], default: [] },

    amountInWords: { type: String, trim: true },
    taxAmountInWords: { type: String, trim: true },

    // No 'finalized' status (unlike Invoice) — a quotation has nothing to finalize; it's
    // either still open, cancelled, or converted into a real invoice.
    status: { type: String, enum: ['open', 'cancelled', 'converted'], default: 'open' },
    convertedToInvoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, strict: true }
);

quotationSchema.index({ company: 1, financialYear: 1, quotationNo: 1 }, { unique: true });
quotationSchema.index({ company: 1, buyer: 1 });
quotationSchema.index({ company: 1, quotationDate: 1 });

export default mongoose.model('Quotation', quotationSchema);
