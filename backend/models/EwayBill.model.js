// EwayBill.model.js — manual e-way bill record, one per sales invoice
// (Section 14: direct GSTN e-Way Bill API integration is out of scope for v1 — this
// is a manual-entry tracker for the number generated on the govt portal)
import mongoose from 'mongoose';

const ewayBillSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },

    ewbNo: { type: String, required: true, trim: true },
    generatedDate: { type: Date, required: true },
    validUpto: { type: Date },
    vehicleNo: { type: String, trim: true },
    transporterName: { type: String, trim: true },
    distance: { type: Number },
  },
  { timestamps: true, strict: true }
);

ewayBillSchema.index({ company: 1, ewbNo: 1 });

export default mongoose.model('EwayBill', ewayBillSchema);
