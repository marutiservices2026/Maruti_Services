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
