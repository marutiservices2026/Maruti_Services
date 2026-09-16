// report.controller.js — sales register and GST summary (Section 1, 7). Cancelled
// documents are excluded from every report — they were never actually supplied, so
// including them would overstate turnover and tax.
import { z } from 'zod';
import mongoose from 'mongoose';
import * as methods from '../methods.js';
import Invoice from '../models/Invoice.model.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

function dateFilter(field, from, to) {
  if (!from && !to) return {};
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  return { [field]: range };
}

const ZERO_TOTALS = { taxableValue: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalAmount: 0 };

function sumTotals(docs) {
  return docs.reduce(
    (acc, doc) => ({
      taxableValue: acc.taxableValue + doc.taxableValue,
      cgstAmount: acc.cgstAmount + doc.cgstAmount,
      sgstAmount: acc.sgstAmount + doc.sgstAmount,
      igstAmount: acc.igstAmount + doc.igstAmount,
      totalAmount: acc.totalAmount + doc.totalAmount,
    }),
    { ...ZERO_TOTALS }
  );
}

// POST /reports/sales-register — body: { from, to }
export const salesRegister = asyncHandler(async (req, res) => {
  const filter = {
    company: req.user.company,
    status: { $ne: 'cancelled' },
    ...dateFilter('invoiceDate', req.body.from, req.body.to),
  };

  const invoices = await methods.findAll(Invoice, filter, {
    sort: { invoiceDate: 1 },
    populate: ['buyer'],
  });

  return new ApiResponse(200, { invoices, totals: sumTotals(invoices) }).send(res);
});

// POST /reports/gst-summary — body: { from, to } — output tax collected on sales. With
// no purchase-side input tax credit tracked (sales-only), GST payable is simply the
// output tax total, not a net figure.
export const gstSummary = asyncHandler(async (req, res) => {
  const companyId = new mongoose.Types.ObjectId(req.user.company);

  const [salesTotals] = await methods.aggregate(Invoice, [
    {
      $match: {
        company: companyId,
        status: { $ne: 'cancelled' },
        ...dateFilter('invoiceDate', req.body.from, req.body.to),
      },
    },
    {
      $group: {
        _id: null,
        taxableValue: { $sum: '$taxableValue' },
        cgstAmount: { $sum: '$cgstAmount' },
        sgstAmount: { $sum: '$sgstAmount' },
        igstAmount: { $sum: '$igstAmount' },
        totalAmount: { $sum: '$totalAmount' },
      },
    },
  ]);

  const output = salesTotals || ZERO_TOTALS;
  const outputTax = output.cgstAmount + output.sgstAmount + output.igstAmount;

  return new ApiResponse(200, {
    output,
    outputTax,
    gstPayable: Math.round(outputTax * 100) / 100,
  }).send(res);
});
