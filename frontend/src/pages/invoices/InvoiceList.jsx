// InvoiceList.jsx — "New Invoice" (button or Space) opens InvoiceForm in a modal rather
// than navigating to /invoices/new, so a batch of invoices can be entered back-to-back
// without ever leaving the list. The routed /invoices/new page still exists for direct
// links; this is just the faster path from the list itself.
import { useCallback, useEffect, useState } from 'react';
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

const STATUS_BADGE = { draft: 'badge-draft', finalized: 'badge-finalized', cancelled: 'badge-cancelled' };
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'finalized', label: 'Finalized' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function InvoiceList() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [result, setResult] = useState({ data: [], total: 0, totalPages: 1, page: 1 });
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

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
                    <td>{inv.invoiceNo}</td>
                    <td>{formatDate(inv.invoiceDate)}</td>
                    <td>{inv.buyer?.name}</td>
                    <td className="num">{formatCurrency(inv.totalAmount)}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[inv.status]}`}>{inv.status}</span>
                    </td>
                    <td className="row-actions">
                      <Link className="btn btn-text" to={`/invoices/${inv._id}`}>
                        View
                      </Link>
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
