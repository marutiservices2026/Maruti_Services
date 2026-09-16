// ProductList.jsx — "New Product" (button or Space) opens ProductForm in a modal
// rather than navigating to /products/new, so entry stays fast and stays on the list.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as productApi from '../../api/product.api.js';
import * as invoiceApi from '../../api/invoice.api.js';
import Button from '../../components/common/Button.jsx';
import Loader from '../../components/common/Loader.jsx';
import Modal from '../../components/common/Modal.jsx';
import KeyboardHintBar from '../../components/common/KeyboardHintBar.jsx';
import ProductForm from './ProductForm.jsx';
import { toast } from '../../components/common/Toast.jsx';
import { confirmDialog } from '../../components/common/ConfirmDialog.jsx';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useSpaceShortcut } from '../../hooks/useSpaceShortcut.js';
import { formatCurrency } from '../../utils/formatters.js';

export default function ProductList() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], total: 0, totalPages: 1, page: 1 });
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await productApi.listProducts({ page, limit: 20, search: debouncedSearch || undefined });
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

  const remove = async (product) => {
    const usage = await invoiceApi.listInvoices({ product: product._id, limit: 1 });
    const invoiceCount = usage.data.data.total;
    const message =
      invoiceCount > 0
        ? `"${product.name}" is used on ${invoiceCount} invoice${invoiceCount === 1 ? '' : 's'}. Deleting it won't change those invoices — they keep their own copy of the line item — but you won't be able to select this product on new invoices. This cannot be undone.`
        : `Delete "${product.name}"? This cannot be undone.`;
    const ok = await confirmDialog({ title: 'Delete product', message });
    if (!ok) return;
    try {
      await productApi.deleteProduct(product._id);
      toast.success('Product deleted.');
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
        <h1>Products</h1>
        <Button onClick={() => setShowCreateModal(true)}>New Product</Button>
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
        <Loader label="Loading products…" />
      ) : result.data.length === 0 ? (
        <div className="empty-state">No products yet — create your first one.</div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>HSN/SAC</th>
                  <th>Unit</th>
                  <th>GST Rate</th>
                  <th className="right">Default Rate</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((p) => (
                  <tr key={p._id}>
                    <td>{p.name}</td>
                    <td>{p.hsnSac}</td>
                    <td>{p.unit?.label || '—'}</td>
                    <td>{p.gstRate?.label || '—'}</td>
                    <td className="num">{formatCurrency(p.defaultRate)}</td>
                    <td className="row-actions">
                      <Link className="btn btn-text" to={`/products/${p._id}/edit`} state={{ product: p }}>
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

      <KeyboardHintBar hints={[{ key: 'Space', label: 'New Product' }]} />

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Product">
        <ProductForm onCancel={() => setShowCreateModal(false)} onSuccess={handleCreated} />
      </Modal>
    </div>
  );
}
