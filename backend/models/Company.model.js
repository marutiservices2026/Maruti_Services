// Company.model.js — seller's own company profile (multi-company ready)
import mongoose from 'mongoose';

const bankDetailsSchema = new mongoose.Schema(
  {
    bankName: { type: String, trim: true },
    accountNo: { type: String, trim: true },
    branch: { type: String, trim: true },
    ifsc: { type: String, trim: true },
  },
  { _id: false }
);

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    tagline: { type: String, trim: true },
    address: { type: String, required: true, trim: true },
    gstin: { type: String, required: true, trim: true, uppercase: true },
    stateName: { type: String, required: true, trim: true },
    stateCode: { type: String, required: true, trim: true },
    pan: { type: String, trim: true, uppercase: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    website: { type: String, trim: true },
    bankDetails: { type: bankDetailsSchema, default: () => ({}) },
    invoiceTemplate: {
      type: String,
      enum: ['classic', 'modern', 'detailed'],
      default: 'classic',
    },
  },
  { timestamps: true, strict: true }
);

export default mongoose.model('Company', companySchema);
