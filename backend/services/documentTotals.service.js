// documentTotals.service.js — shared line-item resolution + GST computation for any
// document type that has a buyer and line items (Invoice, Quotation). Extracted 2026-09-17
// from invoice.controller.js (was `computeInvoiceTotals`/`resolveItems`, invoice-only) so
// Quotation could reuse the exact same resolution logic without duplicating it — a second,
// slightly-different copy of "resolve a product-linked line item's GST rate" is exactly the
// kind of drift that causes a quotation's printed tax estimate to quietly disagree with an
// invoice's for the same product.
import * as methods from '../methods.js';
import Company from '../models/Company.model.js';
import Party from '../models/Party.model.js';
import Product from '../models/Product.model.js';
import Master from '../models/Master.model.js';
import ApiError from '../utils/ApiError.js';
import { computeGst } from './gst.service.js';

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Resolves each incoming line item into its persisted shape, plus a transient _gstRate
// used only for computeGst(). amount is always server-recomputed (quantity * rate) —
// never trust client math for money. gstRate: for product-linked items, pulled from
// that Product's Master:taxRate entry (ignoring any client-supplied gstRate for that
// item); for manual/custom lines, the client must supply it directly.
async function resolveItems(companyId, rawItems) {
  const resolved = [];
  for (const item of rawItems) {
    let gstRate = item.gstRate;

    if (item.product) {
      const product = await methods.findOne(Product, { _id: item.product, company: companyId });
      if (!product) throw ApiError.badRequest(`Product not found: ${item.product}`);
      const taxRateMaster = await methods.findOne(Master, {
        _id: product.gstRate,
        company: companyId,
      });
      gstRate = Number(taxRateMaster?.value) || 0;
    }

    if (gstRate === undefined || gstRate === null) {
      throw ApiError.badRequest(
        `gstRate is required for line item "${item.description}" when no product is referenced.`
      );
    }

    const amount = round2(item.quantity * item.rate);

    resolved.push({
      product: item.product,
      description: item.description,
      hsnSac: item.hsnSac,
      quantity: item.quantity,
      unit: item.unit,
      rate: item.rate,
      amount,
      _gstRate: gstRate,
    });
  }
  return resolved;
}

export function stripTransient(items) {
  return items.map(({ _gstRate, ...rest }) => rest); // eslint-disable-line no-unused-vars
}

export async function computeDocumentTotals(companyId, buyerId, items) {
  const company = await methods.findOne(Company, { _id: companyId });
  if (!company) throw ApiError.notFound('Company not found.');

  const buyer = await methods.findOne(Party, { _id: buyerId, company: companyId });
  if (!buyer) throw ApiError.badRequest('Buyer not found.');
  if (buyer.type !== 'buyer' && buyer.type !== 'both') {
    throw ApiError.badRequest('Selected party is not marked as a buyer.');
  }

  const resolvedItems = await resolveItems(companyId, items);
  const gst = computeGst({
    items: resolvedItems.map((i) => ({ hsnSac: i.hsnSac, amount: i.amount, gstRate: i._gstRate })),
    sellerStateCode: company.stateCode,
    buyerStateCode: buyer.stateCode,
  });

  return {
    resolvedItems,
    gst,
    totalQuantity: resolvedItems.reduce((sum, i) => sum + i.quantity, 0),
  };
}
