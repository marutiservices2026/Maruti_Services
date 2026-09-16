// Dashboard.jsx — a small number of real KPIs (Section 15), plus the sales report
// (GST summary + sales register) folded directly in — no separate Reports nav item, so
// the user doesn't need an extra click to see how the business is doing.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as invoiceApi from '../../api/invoice.api.js';
import * as reportApi from '../../api/report.api.js';
import Loader from '../../components/common/Loader.jsx';
import Button from '../../components/common/Button.jsx';
import DatePicker from '../../components/common/DatePicker.jsx';
import { formatCurrency, formatDate, formatDateInput } from '../../utils/formatters.js';

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [monthSales, setMonthSales] = useState(0);
  const [draftInvoices, setDraftInvoices] = useState(0);
  const [gstPayable, setGstPayable] = useState(0);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reportLoading, setReportLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [sales, setSales] = useState(null);

  useEffect(() => {
    const now = new Date();
    const firstOfMonth = formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1));

    // On first mount, the Sales Report section's own filter (from/to) is still empty, so
    // its GST summary request would be `{}` — identical to the KPI row's own all-time
    // `gstSummary({})` call below. Rather than fire that exact same request twice, fetch it
    // once here and reuse the result for both; `salesRegister` isn't affected the same way
    // (the KPI row deliberately scopes it to month-to-date while the report defaults to
    // all-time — two genuinely different queries, not a duplicate), so that one still needs
    // its own separate report-section fetch.
    Promise.all([
      reportApi.salesRegister({ from: firstOfMonth }),
      invoiceApi.listInvoices({ page: 1, limit: 200 }),
      reportApi.gstSummary({}),
      reportApi.salesRegister({}),
    ]).then(([salesRes, invoicesRes, summaryRes, allTimeSalesRes]) => {
      setMonthSales(salesRes.data.data.totals.totalAmount);
      const drafts = invoicesRes.data.data.data.filter((inv) => inv.status === 'draft').length;
      setDraftInvoices(drafts);
      setGstPayable(summaryRes.data.data.gstPayable);
      setLoading(false);

      setSummary(summaryRes.data.data);
      setSales(allTimeSalesRes.data.data);
      setReportLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadReport = async () => {
    setReportLoading(true);
    const params = { from: from || undefined, to: to || undefined };
    const [summaryRes, salesRes] = await Promise.all([
      reportApi.gstSummary(params),
      reportApi.salesRegister(params),
    ]);
    setSummary(summaryRes.data.data);
    setSales(salesRes.data.data);
    setReportLoading(false);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <div className="row">
          <Button onClick={() => navigate('/invoices/new')}>New Invoice</Button>
        </div>
      </div>

      {loading ? (
        <Loader label="Loading dashboard…" />
      ) : (
        <div className="kpi-row">
          <div className="kpi">
            <div className="kpi-value tabular-nums">{formatCurrency(monthSales)}</div>
            <div className="kpi-label">This Month&apos;s Sales</div>
          </div>
          <div className="kpi">
            <div className="kpi-value tabular-nums">{draftInvoices}</div>
            <div className="kpi-label">Draft Invoices</div>
          </div>
          <div className="kpi">
            <div className="kpi-value tabular-nums">{formatCurrency(gstPayable)}</div>
            <div className="kpi-label">GST Payable</div>
          </div>
        </div>
      )}

      <h3 style={{ marginTop: 32 }}>Sales Report</h3>

      <div className="row" style={{ marginBottom: 16, alignItems: 'flex-end' }}>
        <DatePicker label="From" value={from} onChange={setFrom} />
        <DatePicker label="To" value={to} onChange={setTo} />
        <button className="btn btn-secondary" onClick={loadReport}>
          Apply
        </button>
      </div>

      {reportLoading ? (
        <Loader label="Loading report…" />
      ) : (
        <>
          <div className="kpi-row" style={{ marginBottom: 20 }}>
            <div className="kpi">
              <div className="kpi-value tabular-nums">{formatCurrency(summary.output.taxableValue)}</div>
              <div className="kpi-label">Taxable Value (Sales)</div>
            </div>
            <div className="kpi">
              <div className="kpi-value tabular-nums">{formatCurrency(summary.gstPayable)}</div>
              <div className="kpi-label">GST Payable</div>
            </div>
          </div>

          <div className="table-wrap">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Date</th>
                  <th>Buyer</th>
                  <th className="right">Taxable</th>
                  <th className="right">CGST</th>
                  <th className="right">SGST</th>
                  <th className="right">IGST</th>
                  <th className="right">Total</th>
                </tr>
              </thead>
              <tbody>
                {sales.invoices.map((inv) => (
                  <tr key={inv._id}>
                    <td>{inv.invoiceNo}</td>
                    <td>{formatDate(inv.invoiceDate)}</td>
                    <td>{inv.buyer?.name}</td>
                    <td className="num">{formatCurrency(inv.taxableValue)}</td>
                    <td className="num">{formatCurrency(inv.cgstAmount)}</td>
                    <td className="num">{formatCurrency(inv.sgstAmount)}</td>
                    <td className="num">{formatCurrency(inv.igstAmount)}</td>
                    <td className="num">{formatCurrency(inv.totalAmount)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} className="right" style={{ fontWeight: 700 }}>
                    Total
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {formatCurrency(sales.totals.taxableValue)}
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {formatCurrency(sales.totals.cgstAmount)}
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {formatCurrency(sales.totals.sgstAmount)}
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {formatCurrency(sales.totals.igstAmount)}
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {formatCurrency(sales.totals.totalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
