// EwayBillTracker.jsx — e-way bill threshold flag + manual entry screen for sales
// invoices (Section 1, 14)
import { useEffect, useState } from 'react';
import * as ewaybillApi from '../../api/ewaybill.api.js';
import * as invoiceApi from '../../api/invoice.api.js';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import Loader from '../../components/common/Loader.jsx';
import KeyboardHintBar from '../../components/common/KeyboardHintBar.jsx';
import { formatDate, formatDateInput } from '../../utils/formatters.js';
import { toast } from '../../components/common/Toast.jsx';

export default function EwayBillTracker() {
  const [pending, setPending] = useState([]);
  const [recorded, setRecorded] = useState([]);
  const [loading, setLoading] = useState(true);
  const emptyForm = {
    invoiceId: '',
    ewbNo: '',
    generatedDate: formatDateInput(new Date()),
    validUpto: '',
    vehicleNo: '',
    transporterName: '',
    distance: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [parsing, setParsing] = useState(false);

  const load = async () => {
    setLoading(true);
    const [invRes, ewbRes] = await Promise.all([
      invoiceApi.listInvoices({ page: 1, limit: 50 }),
      ewaybillApi.listEwayBills({ page: 1, limit: 50 }),
    ]);

    const invoicesNeeding = invRes.data.data.data
      .filter((inv) => inv.ewayBillRequired && !inv.ewayBillNo && inv.status !== 'cancelled')
      .map((inv) => ({
        id: inv._id,
        label: `Invoice ${inv.invoiceNo}`,
        date: inv.invoiceDate,
        party: inv.buyer?.name,
      }));

    setPending(invoicesNeeding);
    setRecorded(ewbRes.data.data.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startEntry = (doc) => {
    setForm((f) => ({ ...f, invoiceId: doc.id }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.invoiceId) {
      toast.error('Select an invoice above first.');
      return;
    }
    if (!form.ewbNo.trim()) {
      toast.error('Enter the e-way bill number.');
      return;
    }
    if (!form.generatedDate) {
      toast.error('Select the generated date.');
      return;
    }

    setSubmitting(true);
    try {
      await ewaybillApi.createEwayBill({
        invoice: form.invoiceId,
        ewbNo: form.ewbNo,
        generatedDate: form.generatedDate,
        validUpto: form.validUpto || undefined,
        vehicleNo: form.vehicleNo || undefined,
        transporterName: form.transporterName || undefined,
        distance: form.distance ? Number(form.distance) : undefined,
      });
      toast.success('E-way bill recorded.');
      setForm(emptyForm);
      load();
    } catch {
      // toast already shown by the axios interceptor
    } finally {
      setSubmitting(false);
    }
  };

  // Same Escape/Ctrl+Enter convention as every other save-able form in the app (flagged
  // as missing here in a 2026-09-15 UI/UX audit). This form has no modal to close, so
  // Escape clears it back to its empty/unselected state instead — the closest equivalent
  // of "cancel" for an always-visible inline form.
  const handleFormKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setForm(emptyForm);
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const FIELD_LABELS = {
    ewbNo: 'E-Way Bill No.',
    generatedDate: 'Generated Date',
    validUpto: 'Valid Until',
    vehicleNo: 'Vehicle No.',
    transporterName: 'Transporter Name',
    distance: 'Distance',
  };

  const handleDocumentUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!form.invoiceId) {
      toast.error('Select an invoice above first.');
      return;
    }

    setParsing(true);
    try {
      const res = await ewaybillApi.parseEwayBillDocument(file);
      const { fields } = res.data.data;
      setForm((f) => ({
        ...f,
        ewbNo: fields.ewbNo ?? f.ewbNo,
        generatedDate: fields.generatedDate ?? f.generatedDate,
        validUpto: fields.validUpto ?? f.validUpto,
        vehicleNo: fields.vehicleNo ?? f.vehicleNo,
        transporterName: fields.transporterName ?? f.transporterName,
        distance: fields.distance != null ? String(fields.distance) : f.distance,
      }));
      const foundLabels = Object.keys(fields).map((k) => FIELD_LABELS[k] || k);
      toast.success(`Read from document: ${foundLabels.join(', ')}. Review and save.`);
    } catch {
      // toast already shown by the axios interceptor
    } finally {
      setParsing(false);
    }
  };

  if (loading) return <Loader label="Loading…" />;

  const selectedDoc = pending.find((d) => d.id === form.invoiceId);

  return (
    <div className="page">
      <div className="page-header">
        <h1>E-Way Bills</h1>
      </div>

      <h3>Needs an e-way bill</h3>
      {pending.length === 0 ? (
        <div className="empty-state">Nothing crosses the threshold right now.</div>
      ) : (
        <div className="table-wrap" style={{ marginBottom: 24 }}>
          <table className="ledger">
            <thead>
              <tr>
                <th>Document</th>
                <th>Date</th>
                <th>Party</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((d) => (
                <tr key={d.id}>
                  <td>{d.label}</td>
                  <td>{formatDate(d.date)}</td>
                  <td>{d.party}</td>
                  <td className="row-actions">
                    <button type="button" className="btn btn-text" onClick={() => startEntry(d)}>
                      {form.invoiceId === d.id ? 'Selected' : 'Record e-way bill'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} style={{ maxWidth: 480, marginBottom: 30 }}>
        <h3>Record e-way bill{selectedDoc ? ` for ${selectedDoc.label}` : ''}</h3>

        <div className="field">
          <label htmlFor="ewb-doc-upload">Upload e-Way Bill (auto-fill)</label>
          <input
            id="ewb-doc-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleDocumentUpload}
            disabled={parsing || !form.invoiceId}
          />
          <div className="small muted" style={{ marginTop: 4 }}>
            {parsing
              ? 'Reading document…'
              : 'Upload the PDF or a photo of the e-way bill — fields below will fill in for you to review.'}
          </div>
        </div>

        <Input
          id="ewb-no"
          label="E-Way Bill No."
          value={form.ewbNo}
          onChange={(e) => setForm({ ...form, ewbNo: e.target.value })}
        />
        <Input
          id="ewb-generated-date"
          label="Generated Date"
          type="date"
          value={form.generatedDate}
          onChange={(e) => setForm({ ...form, generatedDate: e.target.value })}
        />
        <Input
          id="ewb-valid-upto"
          label="Valid Until"
          type="date"
          value={form.validUpto}
          onChange={(e) => setForm({ ...form, validUpto: e.target.value })}
        />
        <Input
          id="ewb-vehicle-no"
          label="Vehicle No."
          value={form.vehicleNo}
          onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })}
        />
        <Input
          id="ewb-transporter-name"
          label="Transporter Name"
          value={form.transporterName}
          onChange={(e) => setForm({ ...form, transporterName: e.target.value })}
        />
        <Input
          id="ewb-distance"
          label="Distance (km)"
          type="number"
          value={form.distance}
          onChange={(e) => setForm({ ...form, distance: e.target.value })}
        />
        <Button type="submit" disabled={submitting || !form.invoiceId}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
        <KeyboardHintBar
          hints={[
            { key: 'Ctrl+Enter', label: 'Save' },
            { key: 'Esc', label: 'Clear form' },
          ]}
        />
      </form>

      <h3>Recorded e-way bills</h3>
      {recorded.length === 0 ? (
        <div className="empty-state">No e-way bills recorded yet.</div>
      ) : (
        <div className="table-wrap">
          <table className="ledger">
            <thead>
              <tr>
                <th>E-Way Bill No.</th>
                <th>Document</th>
                <th>Generated</th>
                <th>Vehicle</th>
              </tr>
            </thead>
            <tbody>
              {recorded.map((e) => (
                <tr key={e._id}>
                  <td>{e.ewbNo}</td>
                  <td>{e.invoice ? `Invoice ${e.invoice.invoiceNo}` : '—'}</td>
                  <td>{formatDate(e.generatedDate)}</td>
                  <td>{e.vehicleNo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
