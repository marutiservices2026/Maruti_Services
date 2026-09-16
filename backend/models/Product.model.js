// Product.model.js — HSN/SAC, default rate, tax rate, unit
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true },
    hsnSac: { type: String, required: true, trim: true },
    unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Master', required: true },
    defaultRate: { type: Number, required: true },
    gstRate: { type: mongoose.Schema.Types.ObjectId, ref: 'Master', required: true },
    category: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, strict: true }
);

productSchema.index({ company: 1, name: 1 });

export default mongoose.model('Product', productSchema);
