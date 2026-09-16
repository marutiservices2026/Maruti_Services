// gstCalculator.js — mirrors backend/services/gst.service.js exactly, for instant UI
// feedback (Section 8: "live CGST/SGST/round-off calc as user types") without a
// round-trip to the server. The server always recomputes and is the source of truth —
// this only drives what the user sees while typing.
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

export function computeGst({ items, sellerStateCode, buyerStateCode }) {
  const isInterState = String(sellerStateCode) !== String(buyerStateCode) && Boolean(sellerStateCode) && Boolean(buyerStateCode);
  const lineResults = items.map((item) => computeLineTax(item, isInterState));

  const taxableValue = round2(lineResults.reduce((sum, l) => sum + l.taxableValue, 0));
  const cgstAmount = round2(lineResults.reduce((sum, l) => sum + l.cgstAmount, 0));
  const sgstAmount = round2(lineResults.reduce((sum, l) => sum + l.sgstAmount, 0));
  const igstAmount = round2(lineResults.reduce((sum, l) => sum + l.igstAmount, 0));

  const preRoundTotal = taxableValue + cgstAmount + sgstAmount + igstAmount;
  const totalAmount = Math.round(preRoundTotal);
  const roundOff = round2(totalAmount - preRoundTotal);

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
