// InvoiceLineItems.jsx — voucher-entry-style line items grid (Tally muscle memory):
// Tab moves field-to-field via native DOM order; Enter confirms the current field and
// advances to the next one — on the last field of the last row, Enter appends a fresh
// row and focuses it, so a whole invoice can be typed without ever touching the mouse.
// Alt+D deletes the current row, Alt+I inserts one above, matching Tally's own
// Alt+D / Alt+I conventions. Select fields (Product, manual GST%) advance on their
// `onChange` instead of on Enter, so the browser's native open-dropdown/confirm-option
// behavior is never fought.
import { useEffect, useRef } from 'react';
import Button from '../common/Button.jsx';
import { formatCurrency } from '../../utils/formatters.js';

const FIELD_ORDER = ['product', 'description', 'hsnSac', 'quantity', 'unit', 'rate', 'gstRate'];

function emptyItem() {
  return {
    _key: crypto.randomUUID(),
    product: '',
    description: '',
    hsnSac: '',
    quantity: 1,
    unit: '',
    rate: 0,
    gstRate: '',
  };
}

export default function InvoiceLineItems({ items, onChange, products, taxRates }) {
  const containerRef = useRef(null);
  const pendingFocusRef = useRef(null); // { row, field } to focus once the next render lands

  useEffect(() => {
    if (items.length === 0) onChange([emptyItem()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pendingFocusRef.current) return;
    const { row, field } = pendingFocusRef.current;
    pendingFocusRef.current = null;
    const el = containerRef.current?.querySelector(`[data-row="${row}"][data-field="${field}"]`);
    el?.focus();
    el?.select?.();
  }, [items]);

  const updateItem = (index, patch) => {
    const next = items.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const addRow = (focusAfter = false) => {
    if (focusAfter) pendingFocusRef.current = { row: items.length, field: 'product' };
    onChange([...items, emptyItem()]);
  };

  const removeRow = (index) => {
    if (items.length === 1) return; // always keep at least one row
    const next = items.filter((_, i) => i !== index);
    pendingFocusRef.current = { row: Math.min(index, next.length - 1), field: 'product' };
    onChange(next);
  };

  const insertRowAbove = (index) => {
    const next = items.slice();
    next.splice(index, 0, emptyItem());
    pendingFocusRef.current = { row: index, field: 'product' };
    onChange(next);
  };

  // Finds the next focusable (non-disabled) field in `row` starting at `fromFieldIndex`,
  // spilling over to the next row's first field, or — only when `allowNewRow` is true —
  // appending a new row if this was the last field of the last row. `allowNewRow` defaults
  // to true for the genuine "user pressed Enter to confirm" case (handleRowKeyDown), where
  // auto-adding a row on the last field of the last row is the intended Tally-style
  // continuous-entry behavior. It's turned off for the GST% select below: a plain value
  // pick — which fires the same onChange whether it came from a mouse click or a keyboard
  // confirm, so the two can't be told apart here — shouldn't silently create a whole new
  // line item as a side effect. Moving focus into an *existing* next row is still fine
  // either way, since that doesn't create any new state.
  const advance = (row, fromFieldIndex, { allowNewRow = true } = {}) => {
    const container = containerRef.current;
    const findIn = (r, fromIdx) => {
      for (let i = fromIdx; i < FIELD_ORDER.length; i++) {
        const el = container?.querySelector(`[data-row="${r}"][data-field="${FIELD_ORDER[i]}"]`);
        if (el && !el.disabled) return el;
      }
      return null;
    };

    let target = findIn(row, fromFieldIndex);
    if (!target && row < items.length - 1) {
      target = findIn(row + 1, 0);
    }
    if (target) {
      target.focus();
      target.select?.();
    } else if (allowNewRow) {
      addRow(true);
    }
  };

  const handleProductSelect = (index, productId) => {
    const product = products.find((p) => p._id === productId);
    if (!product) {
      updateItem(index, { product: '' });
    } else {
      updateItem(index, {
        product: productId,
        description: product.name,
        hsnSac: product.hsnSac,
        unit: product.unit?.value || product.unit?.label || '',
        rate: product.defaultRate,
        gstRate: Number(product.gstRate?.value) || '',
      });
    }
    advance(index, FIELD_ORDER.indexOf('product') + 1);
  };

  const handleGstRateSelect = (index, value) => {
    updateItem(index, { gstRate: value });
    advance(index, FIELD_ORDER.indexOf('gstRate') + 1, { allowNewRow: false });
  };

  // Row-level key handling via delegation — one listener per row instead of one per cell.
  const handleRowKeyDown = (e, rowIndex) => {
    if (e.altKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      removeRow(rowIndex);
      return;
    }
    if (e.altKey && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      insertRowAbove(rowIndex);
      return;
    }
    // Selects handle their own advance via onChange, so native Enter (open/confirm the
    // dropdown) is left alone here.
    if (e.key === 'Enter' && e.target.tagName !== 'SELECT') {
      e.preventDefault();
      const fieldIdx = FIELD_ORDER.indexOf(e.target.dataset.field);
      advance(rowIndex, fieldIdx + 1);
    }
  };

  return (
    <div style={{ marginTop: 12 }} ref={containerRef}>
      <div className="table-wrap">
        <table className="ledger voucher-table">
          <thead>
            <tr>
              <th style={{ width: '15%' }}>Product</th>
              <th>Description</th>
              <th style={{ width: '8%' }}>HSN/SAC</th>
              <th style={{ width: '11%' }} className="right">
                Qty
              </th>
              <th style={{ width: '7%' }}>Unit</th>
              <th style={{ width: '12%' }} className="right">
                Rate
              </th>
              <th style={{ width: '8%' }} className="right">
                GST %
              </th>
              <th style={{ width: '11%' }} className="right">
                Amount
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item._key} onKeyDown={(e) => handleRowKeyDown(e, index)}>
                <td>
                  <select
                    className="input"
                    data-row={index}
                    data-field="product"
                    value={item.product}
                    onChange={(e) => handleProductSelect(index, e.target.value)}
                  >
                    <option value="">Manual entry</option>
                    {products.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className="input"
                    data-row={index}
                    data-field="description"
                    value={item.description}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    data-row={index}
                    data-field="hsnSac"
                    value={item.hsnSac}
                    onChange={(e) => updateItem(index, { hsnSac: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="input numeric"
                    type="number"
                    min="0"
                    step="any"
                    data-row={index}
                    data-field="quantity"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    data-row={index}
                    data-field="unit"
                    value={item.unit}
                    onChange={(e) => updateItem(index, { unit: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="input numeric"
                    type="number"
                    min="0"
                    step="0.01"
                    data-row={index}
                    data-field="rate"
                    value={item.rate}
                    onChange={(e) => updateItem(index, { rate: e.target.value })}
                  />
                </td>
                <td>
                  {item.product ? (
                    <span className="num tabular-nums">{item.gstRate}%</span>
                  ) : (
                    <select
                      className="input"
                      data-row={index}
                      data-field="gstRate"
                      value={item.gstRate}
                      onChange={(e) => handleGstRateSelect(index, e.target.value)}
                    >
                      <option value="">—</option>
                      {taxRates.map((r) => (
                        <option key={r._id} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="num">{formatCurrency(Number(item.quantity || 0) * Number(item.rate || 0))}</td>
                <td className="row-actions">
                  <button
                    type="button"
                    className="btn btn-text"
                    onClick={() => removeRow(index)}
                    disabled={items.length === 1}
                    tabIndex={-1}
                    aria-label="Remove line"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '10px 0' }}>
        <Button type="button" variant="secondary" onClick={() => addRow(true)}>
          + Add Line
        </Button>
      </div>
    </div>
  );
}
