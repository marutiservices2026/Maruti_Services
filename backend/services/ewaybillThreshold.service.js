// ewaybillThreshold.service.js — flags a sales invoice as requiring an e-way bill once
// its taxable value crosses the statutory threshold (Section 1: ₹50,000
// by default, configurable via EWAYBILL_THRESHOLD). Direct GSTN e-Way Bill API
// integration is out of scope for v1 (Section 14) — this only sets the flag so the UI
// can prompt for manual entry via EwayBillTracker.jsx.
import { env } from '../config/env.js';

export function isEwayBillRequired(taxableValue) {
  return Number(taxableValue) >= env.ewayBillThreshold;
}
