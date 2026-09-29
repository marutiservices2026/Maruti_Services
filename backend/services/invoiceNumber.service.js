// invoiceNumber.service.js — Counter-based INV- series numbering (Section 6, 9). Numbers
// are scoped per company + Indian financial year (Apr 1 – Mar 31), atomically incremented
// via Counter.model.js so no two invoices in the same company+FY can ever receive the
// same sequence, even under concurrent requests.
import Counter from '../models/Counter.model.js';

const SERIES_KEY = { invoice: 'INV', quotation: 'QTN' };
// DEFAULT_PREFIX.quotation is 'SB' ("Separate Bill" — the user-facing name for this
// document type, see understand.md §12) even though the internal series/model/route names
// all stay 'quotation' — this is the one piece of that naming that's actually printed on
// the document and shown to the user, so it's the one place the rename had to land for real.
const DEFAULT_PREFIX = { invoice: 'GST', quotation: 'SB' };

// Indian financial year runs April 1 – March 31. Returns e.g. "2026-27" for any date
// between 2026-04-01 and 2027-03-31.
export function getFinancialYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const startYear = month >= 4 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

async function incrementCounter(companyId, key, defaultPrefix, session) {
  return Counter.findOneAndUpdate(
    { company: companyId, key },
    { $inc: { seq: 1 }, $setOnInsert: { prefix: defaultPrefix } },
    { new: true, upsert: true, session }
  );
}

/**
 * Generates the next document number in a series, scoped to the company's financial
 * year for `date`. Retries once on a duplicate-key race — two concurrent requests can
 * both attempt to upsert-insert the same brand-new Counter document (Section 10's
 * "rare race condition despite the transaction" fallback).
 *
 * @param {string} companyId
 * @param {'invoice'|'quotation'} series
 * @param {Date} [date]
 * @param {import('mongoose').ClientSession} [session] — pass when called inside a
 *   transaction alongside the Invoice create (Section 9).
 * @returns {Promise<{ documentNo: string, financialYear: string, seq: number }>}
 */
export async function getNextDocumentNumber(companyId, series, date = new Date(), session) {
  const financialYear = getFinancialYear(date);
  const key = `${SERIES_KEY[series]}-${financialYear}`;

  let counter;
  try {
    counter = await incrementCounter(companyId, key, DEFAULT_PREFIX[series], session);
  } catch (err) {
    if (err.code === 11000) {
      counter = await incrementCounter(companyId, key, DEFAULT_PREFIX[series], session);
    } else {
      throw err;
    }
  }

  const documentNo = `${counter.prefix}-${String(counter.seq).padStart(4, '0')}`;
  return { documentNo, financialYear, seq: counter.seq };
}

/**
 * Called after a user manually sets a document's number instead of taking the
 * auto-generated one (added 2026-09-29, at the user's request — see invoice.controller.js's
 * `create`/`update`). Advances this company's Counter forward so the NEXT auto-generated
 * number in this series/financial-year never lands on the manually-set value — otherwise a
 * future ordinary invoice could silently collide with a hand-typed one. Uses `$max`, so it's
 * a no-op if the counter is already ahead, and correctly seeds a brand-new counter to this
 * value via `upsert` if none exists yet (e.g. the very first invoice of the year was itself
 * hand-numbered).
 *
 * Deliberately best-effort, not a hard guarantee: only understands this app's own
 * "<prefix>-<digits>" shape (e.g. "GST-0050"). A manually-set number in some other shape
 * (matching an external system's own scheme) can't be read as a sequence position, so it's
 * left alone — the counter just keeps advancing from wherever it already was. That's an
 * accepted trade-off: once someone is hand-managing numbering, avoiding every possible future
 * collision isn't fully automatable, only the common case (typing ahead within this app's own
 * format) is.
 *
 * @param {string} companyId
 * @param {'invoice'|'quotation'} series
 * @param {string} financialYear
 * @param {string} manualDocumentNo
 * @param {import('mongoose').ClientSession} [session]
 */
export async function advanceCounterPast(companyId, series, financialYear, manualDocumentNo, session) {
  const match = /^[A-Za-z]+-0*(\d+)$/.exec(String(manualDocumentNo || '').trim());
  if (!match) return;
  const manualSeq = Number(match[1]);
  if (!Number.isFinite(manualSeq) || manualSeq <= 0) return;

  const key = `${SERIES_KEY[series]}-${financialYear}`;
  await Counter.findOneAndUpdate(
    { company: companyId, key },
    { $max: { seq: manualSeq }, $setOnInsert: { prefix: DEFAULT_PREFIX[series] } },
    { upsert: true, session }
  );
}
