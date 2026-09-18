// QuotationDetail.jsx — detail page for what the user sees as "Separate Bill" (renamed
// 2026-09-17, internal naming unchanged — see Sidebar.jsx's comment). Mirrors
// InvoiceDetail.jsx's structure. Extra vs. invoice detail: "Convert to Invoice" (only while
// status is 'open'), and a link to the resulting invoice once converted — the one place
// this app deliberately crosses from "estimate" into "real, tracked sale."
import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import * as quotationApi from '../../api/quotation.api.js';
import Button from '../../components/common/Button.jsx';
import Loader from '../../components/common/Loader.jsx';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { toast } from '../../components/common/Toast.jsx';
import { confirmDialog } from '../../components/common/ConfirmDialog.jsx';

const STATUS_BADGE = {
  open: 'badge-draft',
  converted: 'badge-finalized',
  cancelled: 'badge-cancelled',
};

export default function QuotationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [converting, setConverting] = useState(false);

  const load = () => {
    setLoading(true);
    quotationApi.getQuotationDetail(id).then((res) => {
      setQuotation(res.data.data);
      setLoading(false);
    });
  };

  useEffect(load, [id]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await quotationApi.downloadQuotationPdf(id);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quotation.quotationNo}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setDownloading(false);
    }
  };

  const handleConvert = async () => {
    const ok = await confirmDialog({
      title: 'Convert to invoice',
      message: `Convert ${quotation.quotationNo} into a real invoice? This creates an actual tax invoice with its own GST number, fully counted in your sales and GST reports from this point on. This cannot be undone.`,
      confirmLabel: 'Convert to Invoice',
    });
    if (!ok) return;

    setConverting(true);
    try {
      const res = await quotationApi.convertToInvoice(id);
      toast.success('Converted to invoice.');
      navigate(`/invoices/${res.data.data._id}`);
    } catch {
      // toast already shown by the axios interceptor
    } finally {
      setConverting(false);
    }
  };

  const cancelQuotation = async () => {
    const ok = await confirmDialog({
      title: 'Cancel separate bill',
      message: `Cancel ${quotation.quotationNo}? This cannot be undone.`,
      confirmLabel: 'Cancel Separate Bill',
    });
    if (!ok) return;
    await quotationApi.deleteQuotation(id);
    toast.success('Separate bill cancelled.');
    load();
  };

  // Genuinely permanent — distinct from "Cancel" above, which only marks the status and
  // keeps it around. Safe to offer regardless of status: unlike Invoice, a Separate Bill
  // isn't a tax document, so there's no gap-free-numbering reason to keep a deleted one's
  // slot; and if it was already converted, deleting it here never touches the real invoice
  // that resulted from it (that document is fully independent).
  const deleteForever = async () => {
    const convertedNote =
      quotation.status === 'converted'
        ? ' It has already been converted to an invoice — deleting it here will NOT delete or affect that invoice.'
        : '';
    const ok = await confirmDialog({
      title: 'Delete separate bill permanently',
      message: `Permanently delete ${quotation.quotationNo}? This cannot be undone.${convertedNote}`,
      confirmLabel: 'Delete Permanently',
    });
    if (!ok) return;
    await quotationApi.hardDeleteQuotation(id);
    toast.success('Separate bill deleted.');
    navigate('/quotations');
  };

  if (loading || !quotation) return <Loader label="Loading separate bill…" />;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{quotation.quotationNo}</h1>
        <div className="row">
          <span className={`badge ${STATUS_BADGE[quotation.status]}`}>{quotation.status}</span>
          <Button variant="secondary" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Preparing…' : 'Download PDF'}
          </Button>
          {quotation.status === 'open' && (
            <Button variant="secondary" onClick={() => navigate(`/quotations/${id}/edit`)}>
              Edit
            </Button>
          )}
          {quotation.status === 'open' && (
            <Button variant="success" onClick={handleConvert} disabled={converting}>
              {converting ? 'Converting…' : 'Convert to Invoice'}
            </Button>
          )}
          {quotation.status === 'open' && (
            <Button variant="danger" onClick={cancelQuotation}>
              Cancel Separate Bill
            </Button>
          )}
          <Button variant="danger" onClick={deleteForever}>
            Delete
          </Button>
          <Button variant="secondary" onClick={() => navigate('/quotations')}>
            Back
          </Button>
        </div>
      </div>

      {quotation.status === 'converted' && quotation.convertedToInvoice && (
        <p className="small muted" style={{ marginTop: -12, marginBottom: 16 }}>
          Converted to invoice —{' '}
          <Link
            to={`/invoices/${quotation.convertedToInvoice}`}
            className="btn-text"
            style={{ padding: 0 }}
          >
            view it here
          </Link>
          .
        </p>
      )}

      <div className="form-grid" style={{ marginBottom: 20 }}>
        <div>
          <div className="small muted">Buyer</div>
          <div>{quotation.buyer?.name}</div>
          <div className="small">{quotation.buyer?.address}</div>
        </div>
        <div>
          <div className="small muted">Date</div>
          <div>{formatDate(quotation.quotationDate)}</div>
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
            {quotation.items.map((item, i) => (
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
        <div>{quotation.amountInWords}</div>
        <div className="stack" style={{ textAlign: 'right' }}>
          {quotation.igstAmount > 0 ? (
            <div>Est. IGST: {formatCurrency(quotation.igstAmount)}</div>
          ) : (
            <>
              <div>Est. CGST: {formatCurrency(quotation.cgstAmount)}</div>
              <div>Est. SGST: {formatCurrency(quotation.sgstAmount)}</div>
            </>
          )}
          <div>Round Off: {formatCurrency(quotation.roundOff)}</div>
          <strong>Estimated Total: {formatCurrency(quotation.totalAmount)}</strong>
        </div>
      </div>
    </div>
  );
}
