// InvoiceDetail.jsx — invoice detail + PDF download button (Section 12), respecting the
// company/document template selection (the backend picks the template server-side).
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as invoiceApi from '../../api/invoice.api.js';
import Button from '../../components/common/Button.jsx';
import Loader from '../../components/common/Loader.jsx';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { toast } from '../../components/common/Toast.jsx';
import { confirmDialog } from '../../components/common/ConfirmDialog.jsx';

const STATUS_BADGE = { draft: 'badge-draft', finalized: 'badge-finalized', cancelled: 'badge-cancelled' };

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const load = () => {
    setLoading(true);
    invoiceApi.getInvoiceDetail(id).then((res) => {
      setInvoice(res.data.data);
      setLoading(false);
    });
  };

  useEffect(load, [id]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await invoiceApi.downloadInvoicePdf(id);
      const url = URL.createObjectURL(res.data);
      // `Content-Disposition`'s filename (set server-side to the real invoice number)
      // only applies to a direct network navigation — a blob: URL has no such header, so
      // window.open on its own left the browser to invent a random UUID filename on save.
      // An <a download> click is what actually gives a blob URL a real filename.
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoiceNo}.pdf`;
      a.click();
      // Revoking on the same tick can race the browser's own download start in some
      // browsers — a short delay lets it actually grab the blob first.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setDownloading(false);
    }
  };

  const finalize = async () => {
    await invoiceApi.updateInvoice({ id, status: 'finalized' });
    toast.success('Invoice finalized.');
    load();
  };

  const cancelInvoice = async () => {
    const ok = await confirmDialog({
      title: 'Cancel invoice',
      message: `Cancel ${invoice.invoiceNo}? This cannot be undone.`,
      confirmLabel: 'Cancel Invoice',
    });
    if (!ok) return;
    await invoiceApi.deleteInvoice(id);
    toast.success('Invoice cancelled.');
    load();
  };

  if (loading || !invoice) return <Loader label="Loading invoice…" />;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{invoice.invoiceNo}</h1>
        <div className="row">
          <span className={`badge ${STATUS_BADGE[invoice.status]}`}>{invoice.status}</span>
          <Button variant="secondary" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Preparing…' : 'Download PDF'}
          </Button>
          {invoice.status === 'draft' && (
            <Button variant="secondary" onClick={() => navigate(`/invoices/${id}/edit`)}>
              Edit
            </Button>
          )}
          {invoice.status === 'draft' && (
            <Button variant="success" onClick={finalize}>
              Finalize
            </Button>
          )}
          {invoice.status !== 'cancelled' && (
            <Button variant="danger" onClick={cancelInvoice}>
              Cancel Invoice
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate('/invoices')}>
            Back
          </Button>
        </div>
      </div>

      <div className="form-grid" style={{ marginBottom: 20 }}>
        <div>
          <div className="small muted">Buyer</div>
          <div>{invoice.buyer?.name}</div>
          <div className="small">{invoice.buyer?.address}</div>
        </div>
        <div>
          <div className="small muted">Date</div>
          <div>{formatDate(invoice.invoiceDate)}</div>
          {invoice.ewayBillNo && <div className="small">E-Way Bill: {invoice.ewayBillNo}</div>}
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
                <td className="num">{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="spread" style={{ marginTop: 14 }}>
        <div>{invoice.amountInWords}</div>
        <div className="stack" style={{ textAlign: 'right' }}>
          {invoice.igstAmount > 0 ? (
            <div>IGST: {formatCurrency(invoice.igstAmount)}</div>
          ) : (
            <>
              <div>CGST: {formatCurrency(invoice.cgstAmount)}</div>
              <div>SGST: {formatCurrency(invoice.sgstAmount)}</div>
            </>
          )}
          <div>Round Off: {formatCurrency(invoice.roundOff)}</div>
          <strong>Total: {formatCurrency(invoice.totalAmount)}</strong>
        </div>
      </div>
    </div>
  );
}
