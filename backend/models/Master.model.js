// Master.model.js — generic Tally-style master data: replaces hardcoded enums
// (units, tax rates, voucher types, payment terms, states)
import mongoose from 'mongoose';

const masterSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    type: {
      type: String,
      enum: ['unit', 'taxRate', 'voucherType', 'paymentTerms', 'state'],
      required: true,
    },
    code: { type: String, required: true, trim: true }, // e.g. GST18
    label: { type: String, required: true, trim: true }, // e.g. "GST 18%"
    value: { type: String, trim: true }, // e.g. "18"
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, strict: true }
);

masterSchema.index({ company: 1, type: 1, code: 1 }, { unique: true });

export default mongoose.model('Master', masterSchema);
