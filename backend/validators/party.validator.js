// party.validator.js — zod schema for party payloads (Section 7)
import { z } from 'zod';

const PARTY_TYPES = ['buyer', 'supplier', 'both'];

// z.string().email()/.length(15) reject '' outright — but '' is how the client signals
// "clear this field" (see PartyForm.jsx's save handler), not an invalid value, so both
// must accept it alongside a real value.
const optionalGstin = z.union([z.literal(''), z.string().length(15)]).optional();
const optionalEmail = z.union([z.literal(''), z.string().email()]).optional();

const contactInfoSchema = z.object({
  phone: z.string().optional(),
  email: optionalEmail,
});

export const listPartySchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  search: z.string().optional(),
  type: z.enum(PARTY_TYPES).optional(),
});

export const createPartySchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  gstin: optionalGstin,
  stateName: z.string().min(1),
  stateCode: z.string().min(1),
  type: z.enum(PARTY_TYPES),
  contactInfo: contactInfoSchema.optional(),
});

export const updatePartySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  gstin: optionalGstin,
  stateName: z.string().min(1).optional(),
  stateCode: z.string().min(1).optional(),
  type: z.enum(PARTY_TYPES).optional(),
  contactInfo: contactInfoSchema.optional(),
});

export const idSchema = z.object({ id: z.string().min(1) });
