// Party.model.js — buyers/suppliers
import mongoose from 'mongoose';

const partySchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    gstin: { type: String, trim: true, uppercase: true },
    stateName: { type: String, required: true, trim: true },
    stateCode: { type: String, required: true, trim: true },
    type: { type: String, enum: ['buyer', 'supplier', 'both'], required: true },
    contactInfo: {
      phone: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, strict: true }
);

partySchema.index({ company: 1, name: 1 });

export default mongoose.model('Party', partySchema);
