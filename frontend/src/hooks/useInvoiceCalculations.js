// useInvoiceCalculations.js — live CGST/SGST/round-off calc as user types (Section 8:
// debounced on line-item input, memoized so it only recomputes when inputs actually
// settle/change).
import { useMemo } from 'react';
import { useDebounce } from './useDebounce.js';
import { computeGst } from '../utils/gstCalculator.js';

const EMPTY_RESULT = {
  taxableValue: 0,
  cgstRate: 0,
  cgstAmount: 0,
  sgstRate: 0,
  sgstAmount: 0,
  igstRate: 0,
  igstAmount: 0,
  roundOff: 0,
  totalAmount: 0,
  isInterState: false,
  hsnWiseBreakup: [],
  totalQuantity: 0,
};

export function useInvoiceCalculations(items, sellerStateCode, buyerStateCode) {
  const debouncedItems = useDebounce(items, 250);

  return useMemo(() => {
    const validItems = debouncedItems.filter(
      (i) => Number(i.quantity) > 0 && Number(i.rate) >= 0 && i.gstRate !== undefined && i.gstRate !== ''
    );
    if (validItems.length === 0) return EMPTY_RESULT;

    const gstItems = validItems.map((i) => ({
      hsnSac: i.hsnSac || '',
      amount: Number(i.quantity) * Number(i.rate),
      gstRate: Number(i.gstRate) || 0,
    }));

    const result = computeGst({ items: gstItems, sellerStateCode, buyerStateCode });
    const totalQuantity = validItems.reduce((sum, i) => sum + Number(i.quantity), 0);

    return { ...result, totalQuantity };
  }, [debouncedItems, sellerStateCode, buyerStateCode]);
}
