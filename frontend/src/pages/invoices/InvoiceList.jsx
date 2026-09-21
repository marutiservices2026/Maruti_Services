// InvoiceList.jsx — "New Invoice" (button or Space) opens InvoiceForm in a modal rather
// than navigating to /invoices/new, so a batch of invoices can be entered back-to-back
// without ever leaving the list. The routed /invoices/new page still exists for direct
// links; this is just the faster path from the list itself.
import { useCallback, useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as invoiceApi from '../../api/invoice.api.js';
import Button from '../../components/common/Button.jsx';
import Loader from '../../components/common/Loader.jsx';
import Modal from '../../components/common/Modal.jsx';
import Select from '../../components/common/Select.jsx';
import KeyboardHintBar from '../../components/common/KeyboardHintBar.jsx';
import InvoiceForm from '../../components/invoice/InvoiceForm.jsx';
import { useSpaceShortcut } from '../../hooks/useSpaceShortcut.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { toast } from '../../components/common/Toast.jsx';
import { confirmDialog } from '../../components/common/ConfirmDialog.jsx';

const STATUS_BADGE = { draft: 'badge-draft', finalized: 'badge-finalized', cancelled: 'badge-cancelled' };
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'finalized', label: 'Finalized' },
  { value: 'cancelled', label: 'Cancelled' },
];

function StatusDropdown({ status, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (disabled) {
    return <span className={`badge ${STATUS_BADGE[status]}`}>{status}</span>;
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={rootRef}>
      <button
        type="button"
        className={`badge ${STATUS_BADGE[status]}`}
        style={{ padding: '2px 6px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', textTransform: 'capitalize' }}
        onClick={() => setOpen((o) => !o)}
      >
        {status}
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true" style={{ transition: 'transform 150ms ease', transform: open ? 'rotate(180deg)' : 'none', opacity: 0.6 }}>
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="custom-select-popup" style={{ minWidth: 120, top: 'calc(100% + 4px)', left: 0, right: 'auto' }}>
          <button type="button" className={`custom-select-option ${status === 'draft' ? 'selected' : ''}`} onClick={() => { onChange('draft'); setOpen(false); }}>Draft</button>
          <button type="button" className={`custom-select-option ${status === 'finalized' ? 'selected' : ''}`} onClick={() => { onChange('finalized'); setOpen(false); }}>Finalized</button>
          <button type="button" className={`custom-select-option ${status === 'cancelled' ? 'selected' : ''}`} onClick={() => { onChange('cancelled'); setOpen(false); }}>Cancelled</button>
        </div>
      )}
    </div>
  );
}

export default function InvoiceList() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [result, setResult] = useState({ data: [], total: 0, totalPages: 1, page: 1 });
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [printingId, setPrintingId] = useState(null);

  const handlePrint = async (invId) => {
    setPrintingId(invId);
    toast.success('Preparing print...');
    try {
      const pdfRes = await invoiceApi.downloadInvoicePdf(invId);
      const url = URL.createObjectURL(pdfRes.data);
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(url);
          }, 300000); // 5 minutes cleanup
        }, 500);
      };
    } catch {
      // toast already shown by interceptor
    } finally {
      setPrintingId(null);
    }
  };

  const handleStatusChange = async (inv, newStatus) => {
    if (newStatus === inv.status) return;
    
    if (newStatus === 'cancelled') {
      const ok = await confirmDialog({
        title: 'Cancel invoice',
        message: `Cancel ${inv.invoiceNo}? This cannot be undone.`,
        confirmLabel: 'Cancel Invoice',
      });
      if (!ok) return;
      
      await invoiceApi.deleteInvoice(inv._id);
      toast.success('Invoice cancelled.');
      load();
      return;
    }

    if (newStatus === 'finalized' && inv.status === 'draft') {
      await invoiceApi.updateInvoice({ id: inv._id, status: 'finalized' });
      toast.success('Invoice finalized.');
      load();
      return;
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    invoiceApi
      .listInvoices({ page, limit: 20, status: status || undefined, search: debouncedSearch || undefined })
      .then((res) => {
        setResult(res.data.data);
        setLoading(false);
      });
  }, [page, status, debouncedSearch]);

  useEffect(load, [load]);

  useSpaceShortcut(useCallback(() => setShowCreateModal(true), []), !showCreateModal);

  const handleCreated = () => {
    setShowCreateModal(false);
    setPage(1);
    load();
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Invoices</h1>
        <Button onClick={() => setShowCreateModal(true)}>New Invoice</Button>
      </div>

      <div className="row" style={{ gap: 12 }}>
        <div className="field" style={{ maxWidth: 240 }}>
          <input
            className="input"
            placeholder="Search by invoice no.…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div style={{ maxWidth: 200, width: '100%' }}>
          <Select
            value={status}
            options={STATUS_OPTIONS}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          />
        </div>
      </div>

      {loading ? (
        <Loader label="Loading invoices…" />
      ) : result.data.length === 0 ? (
        <div className="empty-state">
          {search || status ? 'No invoices match your search/filter.' : 'No invoices yet — create your first one.'}
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Date</th>
                  <th>Buyer</th>
                  <th className="right">Total</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((inv) => (
                  <tr key={inv._id}>
                    <td>
                      <Link to={`/invoices/${inv._id}`} style={{ fontWeight: 600 }}>
                        {inv.invoiceNo}
                      </Link>
                    </td>
                    <td>{formatDate(inv.invoiceDate)}</td>
                    <td>{inv.buyer?.name}</td>
                    <td className="num">{formatCurrency(inv.totalAmount)}</td>
                    <td>
                      <StatusDropdown 
                        status={inv.status} 
                        onChange={(newStatus) => handleStatusChange(inv, newStatus)} 
                        disabled={inv.status === 'cancelled'} 
                      />
                    </td>
                    <td className="row-actions">
                      <button 
                        className="btn btn-text" 
                        disabled={printingId === inv._id}
                        onClick={() => handlePrint(inv._id)}
                      >
                        {printingId === inv._id ? '...' : 'Print'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>
              Page {result.page} of {result.totalPages}
            </span>
            <button
              className="btn btn-secondary"
              disabled={page >= result.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}

      <KeyboardHintBar hints={[{ key: 'Space', label: 'New Invoice' }]} />

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Invoice" size="lg">
        <InvoiceForm onCancel={() => setShowCreateModal(false)} onSuccess={handleCreated} />
      </Modal>
    </div>
  );
}
