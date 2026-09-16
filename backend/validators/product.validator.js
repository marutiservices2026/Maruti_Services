// product.validator.js — zod schema for product payloads (Section 7)
import { z } from 'zod';

export const listProductSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  search: z.string().optional(),
  category: z.string().optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(1),
  hsnSac: z.string().min(1),
  unit: z.string().min(1), // Master _id, type: unit
  defaultRate: z.number().nonnegative(),
  gstRate: z.string().min(1), // Master _id, type: taxRate
  category: z.string().optional(),
});

export const updateProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  hsnSac: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  defaultRate: z.number().nonnegative().optional(),
  gstRate: z.string().min(1).optional(),
  category: z.string().optional(),
});

export const idSchema = z.object({ id: z.string().min(1) });
