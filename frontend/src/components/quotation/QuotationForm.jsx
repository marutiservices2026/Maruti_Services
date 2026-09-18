// QuotationForm.jsx — creation/edit form for what the user sees as "Separate Bill"
// (renamed 2026-09-17 — internal naming stays "quotation" throughout, see Sidebar.jsx's
// comment). Same delivery/despatch "More Fields" section as InvoiceForm.jsx (added
// 2026-09-17 at the user's request, to match the real invoice's header richness) — still
// no template override, no e-way bill, no validity window. Reuses InvoiceLineItems/
// useInvoiceCalculations/InvoicePreview directly (all already generic, not invoice-specific)
// rather than duplicating them.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as quotationApi from '../../api/quotation.api.js';
import * as partyApi from '../../api/party.api.js';
import * as productApi from '../../api/product.api.js';
import * as companyApi from '../../api/company.api.js';
import * as masterApi from '../../api/master.api.js';
import Input from '../common/Input.jsx';
import Button from '../common/Button.jsx';
import Loader from '../common/Loader.jsx';
import Modal from '../common/Modal.jsx';
import KeyboardHintBar from '../common/KeyboardHintBar.jsx';
import InvoiceLineItems from '../invoice/InvoiceLineItems.jsx';
import InvoicePreview from '../invoice/InvoicePreview.jsx';
import PartyForm from '../../pages/parties/PartyForm.jsx';
import { useInvoiceCalculations } from '../../hooks/useInvoiceCalculations.js';
import { formatCurrency, formatDateInput } from '../../utils/formatters.js';
import { toast } from '../common/Toast.jsx';

// Same best-effort reconstruction as InvoiceForm.jsx's reconstructGstRate — a stored
// quotation's line items don't persist their own gstRate either, only the
// quotation-level hsnWiseBreakup does.
function reconstructGstRate(item, hsnWiseBreakup) {
  const match = (hsnWiseBreakup || []).find((h) => h.hsnSac === item.hsnSac);
  if (!match) return '';
  return match.igstRate > 0 ? match.igstRate : (match.cgstRate || 0) + (match.sgstRate || 0);
}

export default function QuotationForm({ onCancel, onSuccess }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState(null);
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [taxRates, setTaxRates] = useState([]);

  const [quotationNo, setQuotationNo] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [quotationDate, setQuotationDate] = useState(formatDateInput(new Date()));
  const [items, setItems] = useState([]);
  const [showMore, setShowMore] = useState(false);
  const [moreFields, setMoreFields] = useState({
    deliveryNote: '',
    modeOfPayment: '',
    supplierRef: '',
    otherReferences: '',
    buyersOrderNo: '',
    despatchedThrough: '',
    destination: '',
    termsOfDelivery: '',
  });
  const [showNewPartyModal, setShowNewPartyModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    const loaders = [
      companyApi.getCompany(),
      partyApi.listParties({ page: 1, limit: 200, type: 'buyer' }),
      productApi.listProducts({ page: 1, limit: 200 }),
      masterApi.listMasters({ type: 'taxRate' }),
    ];
    if (isEdit) loaders.push(quotationApi.getQuotationDetail(id));

    Promise.all(loaders).then(
      ([companyRes, partiesRes, productsRes, taxRatesRes, quotationRes]) => {
        setCompany(companyRes.data.data);
        setParties(partiesRes.data.data.data);
        setProducts(productsRes.data.data.data);
        setTaxRates(taxRatesRes.data.data);

        if (quotationRes) {
          const q = quotationRes.data.data;
          setQuotationNo(q.quotationNo);
          setBuyerId(q.buyer?._id || q.buyer || '');
          setQuotationDate(formatDateInput(q.quotationDate));
          setMoreFields({
            deliveryNote: q.deliveryNote || '',
            modeOfPayment: q.modeOfPayment || '',
            supplierRef: q.supplierRef || '',
            otherReferences: q.otherReferences || '',
            buyersOrderNo: q.buyersOrderNo || '',
            despatchedThrough: q.despatchedThrough || '',
            destination: q.destination || '',
            termsOfDelivery: q.termsOfDelivery || '',
          });
          setItems(
            q.items.map((item) => ({
              _key: crypto.randomUUID(),
              product: item.product?._id || item.product || '',
              description: item.description,
              hsnSac: item.hsnSac,
              quantity: item.quantity,
              unit: item.unit,
              rate: item.rate,
              gstRate: reconstructGstRate(item, q.hsnWiseBreakup),
            }))
          );
        }

        setLoading(false);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const buyer = parties.find((p) => p._id === buyerId);
  const totals = useInvoiceCalculations(items, company?.stateCode, buyer?.stateCode);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!buyerId) {
      toast.error('Select a buyer.');
      return;
    }

    const payload = {
      buyer: buyerId,
      quotationDate,
      ...moreFields,
      items: items
        .filter((i) => i.description && Number(i.quantity) > 0)
        .map((i) => ({
          product: i.product || undefined,
          description: i.description,
          hsnSac: i.hsnSac,
          quantity: Number(i.quantity),
          unit: i.unit,
          rate: Number(i.rate),
          gstRate: i.product ? undefined : Number(i.gstRate) || 0,
        })),
    };

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = isEdit
        ? await quotationApi.updateQuotation({ id, ...payload })
        : await quotationApi.createQuotation(payload);
      toast.success(isEdit ? 'Separate bill updated.' : 'Separate bill created.');
      if (onSuccess) onSuccess(res.data.data);
      else navigate(`/quotations/${res.data.data._id}`);
    } catch {
      // toast already shown by the axios interceptor
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleCancel = () => (onCancel ? onCancel() : navigate('/quotations'));

  const handlePartyCreated = (party) => {
    setParties((prev) => [...prev, party].sort((a, b) => a.name.localeCompare(b.name)));
    setBuyerId(party._id);
    setShowNewPartyModal(false);
  };

  // Same Escape/Ctrl+Enter reasoning as InvoiceForm.jsx — see that file's comment.
  const handleFormKeyDown = (e) => {
    if (e.key === 'Escape' && !onCancel) {
      e.preventDefault();
      handleCancel();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (loading) return <Loader label="Loading…" />;

  return (
    <>
      <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
        {isEdit && (
          <p className="small muted" style={{ marginTop: -8, marginBottom: 12 }}>
            Editing <strong>{quotationNo}</strong>
          </p>
        )}
        <div className="form-grid">
          <div className="field">
            <label htmlFor="buyer">Buyer</label>
            <div className="row" style={{ gap: 8 }}>
              <select
                id="buyer"
                className="input"
                value={buyerId}
                onChange={(e) => setBuyerId(e.target.value)}
                required
                style={{ flex: 1 }}
              >
                <option value="">Select buyer…</option>
                {parties.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Button type="button" variant="secondary" onClick={() => setShowNewPartyModal(true)}>
                + New
              </Button>
            </div>
          </div>
          <Input
            label="Bill Date"
            type="date"
            value={quotationDate}
            onChange={(e) => setQuotationDate(e.target.value)}
            required
          />
        </div>

        {parties.length === 0 && (
          <p className="small muted">No buyer parties yet — add one from the Parties page first.</p>
        )}

        <button
          type="button"
          className="btn-text"
          style={{ padding: '4px 0', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={() => setShowMore((s) => !s)}
        >
          {showMore ? 'Hide' : 'Show'} delivery &amp; reference details
        </button>

        {showMore && (
          <div className="form-grid">
            <Input
              label="Delivery Note"
              value={moreFields.deliveryNote}
              onChange={(e) => setMoreFields({ ...moreFields, deliveryNote: e.target.value })}
            />
            <Input
              label="Mode/Terms of Payment"
              value={moreFields.modeOfPayment}
              onChange={(e) => setMoreFields({ ...moreFields, modeOfPayment: e.target.value })}
            />
            <Input
              label="Supplier's Ref."
              value={moreFields.supplierRef}
              onChange={(e) => setMoreFields({ ...moreFields, supplierRef: e.target.value })}
            />
            <Input
              label="Other Reference(s)"
              value={moreFields.otherReferences}
              onChange={(e) => setMoreFields({ ...moreFields, otherReferences: e.target.value })}
            />
            <Input
              label="Buyer's Order No."
              value={moreFields.buyersOrderNo}
              onChange={(e) => setMoreFields({ ...moreFields, buyersOrderNo: e.target.value })}
            />
            <Input
              label="Despatched Through"
              value={moreFields.despatchedThrough}
              onChange={(e) => setMoreFields({ ...moreFields, despatchedThrough: e.target.value })}
            />
            <Input
              label="Destination"
              value={moreFields.destination}
              onChange={(e) => setMoreFields({ ...moreFields, destination: e.target.value })}
            />
            <Input
              label="Terms of Delivery"
              value={moreFields.termsOfDelivery}
              onChange={(e) => setMoreFields({ ...moreFields, termsOfDelivery: e.target.value })}
            />
          </div>
        )}

        <InvoiceLineItems
          items={items}
          onChange={setItems}
          products={products}
          taxRates={taxRates}
        />

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <div className="stack" style={{ minWidth: 240, textAlign: 'right' }}>
            <div>
              Taxable Value:{' '}
              <span className="tabular-nums">{formatCurrency(totals.taxableValue)}</span>
            </div>
            {totals.isInterState ? (
              <div>
                Est. IGST: <span className="tabular-nums">{formatCurrency(totals.igstAmount)}</span>
              </div>
            ) : (
              <>
                <div>
                  Est. CGST:{' '}
                  <span className="tabular-nums">{formatCurrency(totals.cgstAmount)}</span>
                </div>
                <div>
                  Est. SGST:{' '}
                  <span className="tabular-nums">{formatCurrency(totals.sgstAmount)}</span>
                </div>
              </>
            )}
            <div>
              Round Off: <span className="tabular-nums">{formatCurrency(totals.roundOff)}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              Estimated Total:{' '}
              <span className="tabular-nums">{formatCurrency(totals.totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="row" style={{ marginTop: 20 }}>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Separate Bill'}
          </Button>
          <Button variant="secondary" type="button" onClick={handleCancel}>
            Cancel
          </Button>
        </div>

        {buyer && company && items.some((i) => i.description) && (
          <div style={{ marginTop: 30 }}>
            <h3>Preview</h3>
            <InvoicePreview
              invoice={{ items, invoiceDate: quotationDate }}
              company={company}
              party={buyer}
              totals={totals}
              documentNo={quotationNo || 'Draft'}
              label="Separate Bill"
            />
          </div>
        )}

        <KeyboardHintBar
          hints={[
            { key: 'Enter', label: 'Next field / new row' },
            { key: 'Alt+D', label: 'Delete row' },
            { key: 'Alt+I', label: 'Insert row above' },
            { key: 'Ctrl+Enter', label: 'Save separate bill' },
            { key: 'Esc', label: 'Cancel' },
          ]}
        />
      </form>
      <Modal open={showNewPartyModal} onClose={() => setShowNewPartyModal(false)} title="New Party">
        <PartyForm onCancel={() => setShowNewPartyModal(false)} onSuccess={handlePartyCreated} />
      </Modal>
    </>
  );
}
