// PartyList.jsx — "New Party" (button or Space) opens PartyForm in a modal rather than
// navigating to /parties/new, so entry stays fast and stays on the list.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as partyApi from '../../api/party.api.js';
import * as invoiceApi from '../../api/invoice.api.js';
import Button from '../../components/common/Button.jsx';
import Loader from '../../components/common/Loader.jsx';
import Modal from '../../components/common/Modal.jsx';
import KeyboardHintBar from '../../components/common/KeyboardHintBar.jsx';
import PartyForm from './PartyForm.jsx';
import { toast } from '../../components/common/Toast.jsx';
import { confirmDialog } from '../../components/common/ConfirmDialog.jsx';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useSpaceShortcut } from '../../hooks/useSpaceShortcut.js';

export default function PartyList() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], total: 0, totalPages: 1, page: 1 });
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await partyApi.listParties({ page, limit: 20, search: debouncedSearch || undefined });
      setResult(res.data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch]);

  useSpaceShortcut(useCallback(() => setShowCreateModal(true), []), !showCreateModal);

  const remove = async (party) => {
    // Invoices keep their own snapshot of buyer details (see understand.md §2), so
    // deleting a referenced party doesn't corrupt past invoices — but it's still worth
    // telling the user up front, since they may not expect a "in use" record to delete
    // this freely.
    const usage = await invoiceApi.listInvoices({ party: party._id, limit: 1 });
    const invoiceCount = usage.data.data.total;
    const message =
      invoiceCount > 0
        ? `"${party.name}" is used on ${invoiceCount} invoice${invoiceCount === 1 ? '' : 's'}. Deleting it won't change those invoices — they keep their own copy of the buyer's details — but you won't be able to select this party on new invoices. This cannot be undone.`
        : `Delete "${party.name}"? This cannot be undone.`;
    const ok = await confirmDialog({ title: 'Delete party', message });
    if (!ok) return;
    try {
      await partyApi.deleteParty(party._id);
      toast.success('Party deleted.');
      load();
    } catch {
      // toast already shown by the axios interceptor
    }
  };

  const handleCreated = () => {
    setShowCreateModal(false);
    setPage(1);
    load();
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Parties</h1>
        <Button onClick={() => setShowCreateModal(true)}>New Party</Button>
      </div>

      <div className="field" style={{ maxWidth: 320 }}>
        <input
          className="input"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {loading ? (
        <Loader label="Loading parties…" />
      ) : result.data.length === 0 ? (
        <div className="empty-state">No parties yet — create your first one.</div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>GSTIN</th>
                  <th>State</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((p) => (
                  <tr key={p._id}>
                    <td>{p.name}</td>
                    <td style={{ textTransform: 'capitalize' }}>{p.type}</td>
                    <td className="small">{p.gstin || '—'}</td>
                    <td>
                      {p.stateName} ({p.stateCode})
                    </td>
                    <td className="row-actions">
                      <Link className="btn btn-text" to={`/parties/${p._id}/edit`} state={{ party: p }}>
                        Edit
                      </Link>
                      <button
                        className="btn btn-text"
                        style={{ color: 'var(--color-stamp-red)' }}
                        onClick={() => remove(p)}
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

      <KeyboardHintBar hints={[{ key: 'Space', label: 'New Party' }]} />

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Party">
        <PartyForm onCancel={() => setShowCreateModal(false)} onSuccess={handleCreated} />
      </Modal>
    </div>
  );
}
