// quotation.validator.js — zod schema for quotation payloads. Deliberately trimmed vs
// invoice.validator.js — no copyType/templateOverride/e-way fields, and never a multi-copy
// PDF (a quotation isn't a tax document) — but as of 2026-09-17 it does share the same
// delivery/despatch/reference field set as Invoice, at the user's request to match the real
// invoice's header layout/richness.
import { z } from 'zod';

const STATUSES = ['open', 'cancelled', 'converted'];

// Same gstRate-required-only-for-manual-lines rule as invoice.validator.js — see that
// file's comment; enforced the same way, in the controller via documentTotals.service.js.
const quotationItemSchema = z.object({
  product: z.string().optional(),
  description: z.string().min(1),
  hsnSac: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  rate: z.number().nonnegative(),
  gstRate: z.number().min(0).max(100).optional(),
});

// Same shape as invoice.validator.js's invoiceHeaderFields, minus documentTitle/copyType/
// templateOverride (all invoice-PDF-specific concepts that don't apply here).
const quotationHeaderFields = {
  deliveryNote: z.string().optional(),
  modeOfPayment: z.string().optional(),
  supplierRef: z.string().optional(),
  otherReferences: z.string().optional(),
  buyersOrderNo: z.string().optional(),
  buyersOrderDate: z.coerce.date().optional(),
  despatchDocNo: z.string().optional(),
  despatchDocDate: z.coerce.date().optional(),
  despatchedThrough: z.string().optional(),
  destination: z.string().optional(),
  termsOfDelivery: z.string().optional(),
};

export const createQuotationSchema = z.object({
  buyer: z.string().min(1),
  quotationDate: z.coerce.date(),
  items: z.array(quotationItemSchema).min(1),
  ...quotationHeaderFields,
});

export const updateQuotationSchema = z.object({
  id: z.string().min(1),
  buyer: z.string().min(1).optional(),
  quotationDate: z.coerce.date().optional(),
  items: z.array(quotationItemSchema).min(1).optional(),
  status: z.enum(STATUSES).optional(),
  ...quotationHeaderFields,
});

export const listQuotationSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  party: z.string().optional(),
  status: z.enum(STATUSES).optional(),
  search: z.string().optional(),
});

export const idSchema = z.object({ id: z.string().min(1) });

export const bulkIdsSchema = z.object({ ids: z.array(z.string().min(1)).min(1) });
