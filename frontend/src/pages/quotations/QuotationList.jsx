// QuotationList.jsx — mirrors InvoiceList.jsx's "New Invoice" modal-first pattern.
// Displayed to the user as "Separate Bills" (renamed 2026-09-17) — internal naming
// (quotationNo, /quotations/* routes, etc.) stays as-is throughout, only user-facing text
// changed. See Sidebar.jsx's comment for the same note.
// Checkbox multi-select + bulk delete added 2026-09-18, alongside a per-row single delete —
// both call the genuine hard-delete added the same day (see QuotationDetail.jsx / this
// file's own handleBulkDelete for why that's safe for this document type specifically).
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as quotationApi from '../../api/quotation.api.js';
import Button from '../../components/common/Button.jsx';
import Loader from '../../components/common/Loader.jsx';
import Modal from '../../components/common/Modal.jsx';
import Select from '../../components/common/Select.jsx';
import KeyboardHintBar from '../../components/common/KeyboardHintBar.jsx';
import QuotationForm from '../../components/quotation/QuotationForm.jsx';
import { useSpaceShortcut } from '../../hooks/useSpaceShortcut.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { toast } from '../../components/common/Toast.jsx';
import { confirmDialog } from '../../components/common/ConfirmDialog.jsx';

const STATUS_BADGE = {
  open: 'badge-draft',
  converted: 'badge-finalized',
  cancelled: 'badge-cancelled',
};
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'converted', label: 'Converted' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function QuotationList() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [result, setResult] = useState({ data: [], total: 0, totalPages: 1, page: 1 });
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    quotationApi
      .listQuotations({
        page,
        limit: 20,
        status: status || undefined,
        search: debouncedSearch || undefined,
      })
      .then((res) => {
        setResult(res.data.data);
        setSelectedIds(new Set()); // a fresh page/filter load invalidates any prior selection
        setLoading(false);
      });
  }, [page, status, debouncedSearch]);

  useEffect(load, [load]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allOnPageSelected =
    result.data.length > 0 && result.data.every((q) => selectedIds.has(q._id));
  const toggleSelectAll = () => {
    if (allOnPageSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(result.data.map((q) => q._id)));
  };

  const handleRowDelete = async (q) => {
    const ok = await confirmDialog({
      title: 'Delete separate bill',
      message: `Permanently delete ${q.quotationNo}? This cannot be undone.`,
      confirmLabel: 'Delete Permanently',
    });
    if (!ok) return;
    await quotationApi.hardDeleteQuotation(q._id);
    toast.success('Separate bill deleted.');
    load();
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    const ok = await confirmDialog({
      title: 'Delete separate bills',
      message: `Permanently delete ${count} selected separate bill${count === 1 ? '' : 's'}? This cannot be undone.`,
      confirmLabel: 'Delete Permanently',
    });
    if (!ok) return;
    setBulkDeleting(true);
    try {
      await quotationApi.bulkDeleteQuotations([...selectedIds]);
      toast.success(`${count} separate bill${count === 1 ? '' : 's'} deleted.`);
      setPage(1);
      load();
    } catch {
      // toast already shown by the axios interceptor
    } finally {
      setBulkDeleting(false);
    }
  };

  useSpaceShortcut(
    useCallback(() => setShowCreateModal(true), []),
    !showCreateModal
  );

  const handleCreated = () => {
    setShowCreateModal(false);
    setPage(1);
    load();
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Separate Bills</h1>
        <Button onClick={() => setShowCreateModal(true)}>New Separate Bill</Button>
      </div>

      <div className="row" style={{ gap: 12 }}>
        <div className="field" style={{ maxWidth: 240 }}>
          <input
            className="input"
            placeholder="Search by separate bill no.…"
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
        <Loader label="Loading separate bills…" />
      ) : result.data.length === 0 ? (
        <div className="empty-state">
          {search || status
            ? 'No separate bills match your search/filter.'
            : 'No separate bills yet — create your first one.'}
        </div>
      ) : (
        <>
          {selectedIds.size > 0 && (
            <div className="row" style={{ margin: '12px 0', gap: 10 }}>
              <span className="small muted">{selectedIds.size} selected</span>
              <Button variant="danger" onClick={handleBulkDelete} disabled={bulkDeleting}>
                {bulkDeleting ? 'Deleting…' : `Delete Selected (${selectedIds.size})`}
              </Button>
            </div>
          )}
          <div className="table-wrap">
            <table className="ledger">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all on this page"
                    />
                  </th>
                  <th>Separate Bill No.</th>
                  <th>Date</th>
                  <th>Buyer</th>
                  <th className="right">Est. Total</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((q) => (
                  <tr key={q._id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(q._id)}
                        onChange={() => toggleSelect(q._id)}
                        aria-label={`Select ${q.quotationNo}`}
                      />
                    </td>
                    <td>{q.quotationNo}</td>
                    <td>{formatDate(q.quotationDate)}</td>
                    <td>{q.buyer?.name}</td>
                    <td className="num">{formatCurrency(q.totalAmount)}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[q.status]}`}>{q.status}</span>
                    </td>
                    <td className="row-actions">
                      <Link className="btn btn-text" to={`/quotations/${q._id}`}>
                        View
                      </Link>
                      <button
                        className="btn btn-text"
                        style={{ color: 'var(--color-stamp-red)' }}
                        onClick={() => handleRowDelete(q)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <button
              className="btn btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
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

      <KeyboardHintBar hints={[{ key: 'Space', label: 'New Separate Bill' }]} />

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New Separate Bill"
        size="lg"
      >
        <QuotationForm onCancel={() => setShowCreateModal(false)} onSuccess={handleCreated} />
      </Modal>
    </div>
  );
}
