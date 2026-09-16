// gst.service.js — CGST/SGST/IGST + round-off calculation (Section 2, 3), used by
// invoice creation.
//
// Rule: buyer state code == seller state code -> CGST + SGST (rate split in half each);
//       otherwise -> IGST at the full rate.
// Round Off = round(total) - total, carried as a signed adjustment line.

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function computeLineTax(item, isInterState) {
  const taxableValue = round2(item.amount);
  const rate = Number(item.gstRate) || 0;

  let cgstRate = 0;
  let sgstRate = 0;
  let igstRate = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterState) {
    igstRate = rate;
    igstAmount = round2((taxableValue * rate) / 100);
  } else {
    cgstRate = rate / 2;
    sgstRate = rate / 2;
    cgstAmount = round2((taxableValue * cgstRate) / 100);
    sgstAmount = round2((taxableValue * sgstRate) / 100);
  }

  return {
    hsnSac: item.hsnSac,
    taxableValue,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    totalTax: round2(cgstAmount + sgstAmount + igstAmount),
  };
}

// Groups line-level tax results by HSN/SAC + rate combination, for the Section 2
// "HSN/SAC-wise tax breakup table" (Taxable Value, CGST Rate/Amount, SGST Rate/Amount,
// Total Tax Amount).
function groupByHsn(lineResults) {
  const groups = new Map();
  for (const line of lineResults) {
    const key = `${line.hsnSac}|${line.cgstRate}|${line.sgstRate}|${line.igstRate}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { ...line });
    } else {
      existing.taxableValue = round2(existing.taxableValue + line.taxableValue);
      existing.cgstAmount = round2(existing.cgstAmount + line.cgstAmount);
      existing.sgstAmount = round2(existing.sgstAmount + line.sgstAmount);
      existing.igstAmount = round2(existing.igstAmount + line.igstAmount);
      existing.totalTax = round2(existing.totalTax + line.totalTax);
    }
  }
  return Array.from(groups.values());
}

/**
 * @param {Object} params
 * @param {{ hsnSac: string, amount: number, gstRate: number }[]} params.items — each
 *   item's taxable value (amount) and its statutory GST percentage (e.g. 18 for 18%).
 * @param {string} params.sellerStateCode — two-digit GST state code.
 * @param {string} params.buyerStateCode — two-digit GST state code.
 */
export function computeGst({ items, sellerStateCode, buyerStateCode }) {
  const isInterState = String(sellerStateCode) !== String(buyerStateCode);
  const lineResults = items.map((item) => computeLineTax(item, isInterState));

  const taxableValue = round2(lineResults.reduce((sum, l) => sum + l.taxableValue, 0));
  const cgstAmount = round2(lineResults.reduce((sum, l) => sum + l.cgstAmount, 0));
  const sgstAmount = round2(lineResults.reduce((sum, l) => sum + l.sgstAmount, 0));
  const igstAmount = round2(lineResults.reduce((sum, l) => sum + l.igstAmount, 0));

  const preRoundTotal = taxableValue + cgstAmount + sgstAmount + igstAmount;
  const totalAmount = Math.round(preRoundTotal);
  const roundOff = round2(totalAmount - preRoundTotal);

  // Representative rate for the invoice-level cgstRate/sgstRate/igstRate fields —
  // meaningful when every line shares one rate (the common case). Mixed-rate documents
  // carry the real per-rate detail in hsnWiseBreakup.
  const cgstRate = lineResults[0]?.cgstRate || 0;
  const sgstRate = lineResults[0]?.sgstRate || 0;
  const igstRate = lineResults[0]?.igstRate || 0;

  return {
    isInterState,
    taxableValue,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    roundOff,
    totalAmount,
    hsnWiseBreakup: groupByHsn(lineResults),
  };
}
