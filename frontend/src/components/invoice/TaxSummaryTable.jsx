// TaxSummaryTable.jsx — HSN/SAC-wise tax breakup table (Section 2).
import { formatCurrency } from '../../utils/formatters.js';

export default function TaxSummaryTable({ hsnWiseBreakup, isInterState }) {
  if (!hsnWiseBreakup || hsnWiseBreakup.length === 0) return null;

  return (
    <div className="table-wrap" style={{ marginTop: 12 }}>
      <table className="ledger">
        <thead>
          <tr>
            <th>HSN/SAC</th>
            <th className="right">Taxable Value</th>
            {isInterState ? (
              <th className="right" colSpan={2}>
                IGST
              </th>
            ) : (
              <>
                <th className="right" colSpan={2}>
                  CGST
                </th>
                <th className="right" colSpan={2}>
                  SGST
                </th>
              </>
            )}
            <th className="right">Total Tax</th>
          </tr>
        </thead>
        <tbody>
          {hsnWiseBreakup.map((row, i) => (
            <tr key={i}>
              <td>{row.hsnSac}</td>
              <td className="num">{formatCurrency(row.taxableValue)}</td>
              {isInterState ? (
                <>
                  <td className="num">{row.igstRate}%</td>
                  <td className="num">{formatCurrency(row.igstAmount)}</td>
                </>
              ) : (
                <>
                  <td className="num">{row.cgstRate}%</td>
                  <td className="num">{formatCurrency(row.cgstAmount)}</td>
                  <td className="num">{row.sgstRate}%</td>
                  <td className="num">{formatCurrency(row.sgstAmount)}</td>
                </>
              )}
              <td className="num">{formatCurrency(row.totalTax)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
