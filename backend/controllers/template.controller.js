// template.controller.js — lists available templates for a document type (Section 16).
// The three layouts are fixed/code-defined for v1 — no DB-backed CRUD, only selection
// (handled by company.controller.js's setTemplate).
import { z } from 'zod';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const listTemplatesSchema = z.object({
  documentType: z.literal('invoice'),
});

const TEMPLATE_CATALOG = [
  {
    key: 'classic',
    label: 'Classic Ledger',
    description:
      "Boxed header grid, ruled item table, boxed tax summary — matches the reference tax invoice exactly. The default, and what customers already recognize as a proper tax invoice.",
  },
  {
    key: 'modern',
    label: 'Modern Compact',
    description:
      'Same GST-compliant fields, tightened spacing, a single-rule table, and the letterhead as a simple top band — for clients who email PDFs more than they print.',
  },
  {
    key: 'detailed',
    label: 'Detailed Register',
    description:
      'Denser row height with a repeating item-table header, built for high-line-item invoices (10+ items) rather than aesthetics.',
  },
];

// POST /templates/list — body: { documentType } (invoice)
export const list = asyncHandler(async (req, res) => {
  const templates = TEMPLATE_CATALOG.map((t) => ({ ...t, documentType: req.body.documentType }));
  return new ApiResponse(200, templates).send(res);
});
