// invoice.validator.js — zod schema for invoice payloads (Section 2, 6, 7)
import { z } from 'zod';

const COPY_TYPES = ['Original for Recipient', 'Duplicate for Transporter', 'Triplicate for Supplier'];
const TEMPLATES = ['classic', 'modern', 'detailed'];
const STATUSES = ['draft', 'finalized', 'cancelled'];

// gstRate is only required when `product` is omitted — for product-linked items the
// server derives the rate from the Product's Master:taxRate entry and ignores any
// client-supplied gstRate (never trust client input for money). Enforced in the
// controller, since it depends on which branch (product vs. manual line) is taken.
const invoiceItemSchema = z.object({
  product: z.string().optional(),
  description: z.string().min(1),
  hsnSac: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  rate: z.number().nonnegative(),
  gstRate: z.number().min(0).max(100).optional(),
});

const invoiceHeaderFields = {
  documentTitle: z.string().optional(),
  copyType: z.enum(COPY_TYPES).optional(),
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
  templateOverride: z.enum(TEMPLATES).optional(),
};

export const createInvoiceSchema = z.object({
  buyer: z.string().min(1),
  invoiceDate: z.coerce.date(),
  items: z.array(invoiceItemSchema).min(1),
  ...invoiceHeaderFields,
});

export const updateInvoiceSchema = z.object({
  id: z.string().min(1),
  buyer: z.string().min(1).optional(),
  invoiceDate: z.coerce.date().optional(),
  items: z.array(invoiceItemSchema).min(1).optional(),
  status: z.enum(STATUSES).optional(),
  ewayBillNo: z.string().optional(),
  ...invoiceHeaderFields,
});

export const listInvoiceSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  party: z.string().optional(),
  product: z.string().optional(),
  status: z.enum(STATUSES).optional(),
  search: z.string().optional(),
});

export const idSchema = z.object({ id: z.string().min(1) });
