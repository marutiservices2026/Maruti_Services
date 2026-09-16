// Counter.model.js — atomic, gap-free invoice numbering per financial year (INV- series;
// incremented inside a MongoDB transaction alongside document creation — see
// invoiceNumber.service.js and Section 9)
import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    key: { type: String, required: true, trim: true }, // e.g. INV-2026-27, PUR-2026-27
    seq: { type: Number, default: 0 },
    prefix: { type: String, default: 'GST', trim: true }, // client-editable, Tally-style voucher prefix
  },
  { timestamps: true, strict: true }
);

counterSchema.index({ company: 1, key: 1 }, { unique: true });

export default mongoose.model('Counter', counterSchema);
