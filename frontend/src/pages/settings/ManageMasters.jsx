// ManageMasters.jsx — Tally-style master lists (units, tax rates, voucher types,
// payment terms, states — Section 6a)
import { useEffect, useState } from 'react';
import * as masterApi from '../../api/master.api.js';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import Loader from '../../components/common/Loader.jsx';
import Select from '../../components/common/Select.jsx';
import SettingsNav from '../../components/settings/SettingsNav.jsx';
import { toast } from '../../components/common/Toast.jsx';
import { confirmDialog } from '../../components/common/ConfirmDialog.jsx';

const TYPES = ['unit', 'taxRate', 'voucherType', 'paymentTerms', 'state'];
const TYPE_OPTIONS = TYPES.map((t) => ({ value: t, label: t }));

export default function ManageMasters() {
  const [type, setType] = useState('unit');
  const [masters, setMasters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: '', label: '', value: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await masterApi.listMasters({ type, includeInactive: true });
      setMasters(res.data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const handleCreate = async (e) => {
    e.preventDefault();
    await masterApi.createMaster({ type, ...form });
    setForm({ code: '', label: '', value: '' });
    toast.success('Master entry created.');
    load();
  };

  const toggleActive = async (m) => {
    await masterApi.updateMaster({ id: m._id, isActive: !m.isActive });
    load();
  };

  const remove = async (m) => {
    const ok = await confirmDialog({
      title: 'Delete master entry',
      message: `Delete "${m.label}"? Anything already saved with this value keeps it, but it won't be selectable anymore. This cannot be undone.`,
    });
    if (!ok) return;
    await masterApi.deleteMaster(m._id);
    toast.success('Master entry deleted.');
    load();
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
      </div>
      <SettingsNav />

      <div style={{ maxWidth: 240 }}>
        <Select label="Type" value={type} options={TYPE_OPTIONS} onChange={setType} />
      </div>

      <form onSubmit={handleCreate} className="form-grid" style={{ marginBottom: 20, alignItems: 'end' }}>
        <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
        <Input
          label="Label"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          required
        />
        <Input label="Value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
        <Button type="submit">Add</Button>
      </form>

      {loading ? (
        <Loader label="Loading masters…" />
      ) : masters.length === 0 ? (
        <div className="empty-state">No {type} entries yet — add your first one above.</div>
      ) : (
        <div className="table-wrap">
          <table className="ledger">
            <thead>
              <tr>
                <th>Code</th>
                <th>Label</th>
                <th>Value</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {masters.map((m) => (
                <tr key={m._id}>
                  <td>{m.code}</td>
                  <td>{m.label}</td>
                  <td>{m.value}</td>
                  <td>
                    <span className={`badge ${m.isActive ? 'badge-finalized' : 'badge-draft'}`}>
                      {m.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="row-actions">
                    <button className="btn btn-text" onClick={() => toggleActive(m)}>
                      {m.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      className="btn btn-text"
                      style={{ color: 'var(--color-stamp-red)' }}
                      onClick={() => remove(m)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
