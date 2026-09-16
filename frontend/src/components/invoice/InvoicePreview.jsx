// InvoicePreview.jsx — mirrors the PDF layout on-screen (Section 15, 16), echoing the
// reference sample's own layout logic (boxed header, ruled item table, boxed tax
// summary) rather than a "modern card" treatment. Renders the Classic Ledger structure
// regardless of templateKey — full on-screen parity with all three PDF layouts
// (classic/modern/detailed) is a larger follow-up; the actual PDF download always
// renders the company's real selected template correctly.
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { amountToWords } from '../../utils/numberToWords.js';
import TaxSummaryTable from './TaxSummaryTable.jsx';

export default function InvoicePreview({ invoice, company, party, totals, documentNo, label = 'Tax Invoice' }) {
  if (!invoice || !company || !party) return null;

  const isInterState = totals.isInterState;

  return (
    <div style={{ border: '1px solid var(--color-rule-grey)', background: '#fff', padding: 16, fontSize: 12.5 }}>
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <strong style={{ fontSize: 15 }}>{label}</strong>
      </div>

      <div className="form-grid" style={{ marginBottom: 10 }}>
        <div>
          <strong>{company.name}</strong>
          <div className="small">{company.address}</div>
          <div className="small">GSTIN: {company.gstin}</div>
          <div className="small">
            {company.stateName} ({company.stateCode})
          </div>
        </div>
        <div className="right">
          <div>
            No.: <strong>{documentNo || 'Draft'}</strong>
          </div>
          <div>Date: {formatDate(invoice.invoiceDate)}</div>
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <strong>Party:</strong> {party.name}
        <div className="small">{party.address}</div>
        <div className="small">
          GSTIN: {party.gstin} — {party.stateName} ({party.stateCode})
        </div>
      </div>

      <div className="table-wrap">
        <table className="ledger">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>HSN/SAC</th>
              <th className="right">Qty</th>
              <th className="right">Rate</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{item.description}</td>
                <td>{item.hsnSac}</td>
                <td className="num">
                  {item.quantity} {item.unit}
                </td>
                <td className="num">{formatCurrency(item.rate)}</td>
                <td className="num">{formatCurrency(Number(item.quantity || 0) * Number(item.rate || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="spread" style={{ marginTop: 10 }}>
        <div>
          <div className="small muted">Amount Chargeable (in words)</div>
          <strong>{amountToWords(totals.totalAmount)}</strong>
        </div>
        <div className="right">
          {isInterState ? (
            <div>IGST: {formatCurrency(totals.igstAmount)}</div>
          ) : (
            <>
              <div>CGST: {formatCurrency(totals.cgstAmount)}</div>
              <div>SGST: {formatCurrency(totals.sgstAmount)}</div>
            </>
          )}
          <div>Round Off: {formatCurrency(totals.roundOff)}</div>
          <strong>Total: {formatCurrency(totals.totalAmount)}</strong>
        </div>
      </div>

      <TaxSummaryTable hsnWiseBreakup={totals.hsnWiseBreakup} isInterState={isInterState} />
    </div>
  );
}
