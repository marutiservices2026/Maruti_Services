// apiError.js — turns a backend error response into a message a user can actually act on.
// error.middleware.js always sends a generic top-level `message` for validation failures
// ("Validation failed.") plus a field-level `errors: [{field, message}]` array with the
// actual reason — but nothing was reading that array, so every validation failure anywhere
// in the app showed the same bare "Validation failed." with no indication of what was
// wrong (flagged in a 2026-09-15 audit). This builds a real message from it.
const ACRONYMS = { gstin: 'GSTIN', hsnsac: 'HSN/SAC', pan: 'PAN', ifsc: 'IFSC' };

// Field paths from Zod are camelCase ("stateCode") or dotted/indexed for nested data
// ("items.0.quantity") — only the simple, single-segment case can be humanized reliably;
// nested paths are left as-is rather than guessed at.
function humanizeField(field) {
  if (!field || field.includes('.')) return field;
  const known = ACRONYMS[field.toLowerCase()];
  if (known) return known;
  return field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

export function formatApiErrorMessage(data, fallback = 'Something went wrong. Please try again.') {
  if (!data) return fallback;

  const parts = (data.errors || [])
    .map((e) => (e.field ? `${humanizeField(e.field)}: ${e.message}` : e.message))
    .filter(Boolean);

  if (parts.length === 0) return data.message || fallback;
  if (parts.length === 1) return parts[0];
  return `${data.message || 'Validation failed.'} ${parts.join('; ')}`;
}
