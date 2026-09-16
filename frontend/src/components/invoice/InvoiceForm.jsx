// InvoiceForm.jsx — invoice creation/edit form with live tax calculation + dynamic
// fields (Section 8, 12). Edit mode is only ever reached for draft invoices — see the
// "Edit" button in InvoiceDetail.jsx, which is deliberately hidden once finalized
// (matches real accounting practice: a finalized/issued invoice isn't silently altered,
// it's cancelled and reissued — the backend's own updateInvoiceSchema/FINANCIAL_FIELDS
// guard would reject a financial-field edit on a finalized invoice anyway, but the UI
// doesn't even offer the option so there's nothing to reject in practice).
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as invoiceApi from '../../api/invoice.api.js';
import * as partyApi from '../../api/party.api.js';
import * as productApi from '../../api/product.api.js';
import * as companyApi from '../../api/company.api.js';
import * as masterApi from '../../api/master.api.js';
import Input from '../common/Input.jsx';
import Button from '../common/Button.jsx';
import Loader from '../common/Loader.jsx';
import Modal from '../common/Modal.jsx';
import KeyboardHintBar from '../common/KeyboardHintBar.jsx';
import InvoiceLineItems from './InvoiceLineItems.jsx';
import InvoicePreview from './InvoicePreview.jsx';
import PartyForm from '../../pages/parties/PartyForm.jsx';
import { useInvoiceCalculations } from '../../hooks/useInvoiceCalculations.js';
import { formatCurrency, formatDateInput } from '../../utils/formatters.js';
import { toast } from '../common/Toast.jsx';

// A stored invoice's line items don't persist their own gstRate (see Invoice.model.js —
// only the invoice-level hsnWiseBreakup does), so editing has to reconstruct it by
// matching each item's hsnSac against that breakup. Best-effort: if two line items on
// the same invoice share an HSN but were taxed at different rates (rare), both would
// resolve to whichever breakup entry matches first — acceptable for a v1 edit form since
// the reconstructed value is only a pre-fill, and the user can correct it before saving.
function reconstructGstRate(item, hsnWiseBreakup) {
  const match = (hsnWiseBreakup || []).find((h) => h.hsnSac === item.hsnSac);
  if (!match) return '';
  return match.igstRate > 0 ? match.igstRate : (match.cgstRate || 0) + (match.sgstRate || 0);
}

// onCancel/onSuccess: when provided (e.g. rendered inside a Modal from InvoiceList's
// "New Invoice" / Space shortcut), these replace the default navigate-away behavior —
// closing the modal and refreshing the list instead of leaving the page.
export default function InvoiceForm({ onCancel, onSuccess }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState(null);
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [taxRates, setTaxRates] = useState([]);

  const [invoiceNo, setInvoiceNo] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(formatDateInput(new Date()));
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
  // A second/third click that lands before React re-renders the disabled button still
  // reads the same stale `submitting` closure (state updates from the same synchronous
  // click batch don't apply until the next render) — so the real guard has to be a ref,
  // which mutates immediately, not the state used to drive the button's disabled look.
  const submittingRef = useRef(false);

  useEffect(() => {
    const loaders = [
      companyApi.getCompany(),
      partyApi.listParties({ page: 1, limit: 200, type: 'buyer' }),
      productApi.listProducts({ page: 1, limit: 200 }),
      masterApi.listMasters({ type: 'taxRate' }),
    ];
    if (isEdit) loaders.push(invoiceApi.getInvoiceDetail(id));

    Promise.all(loaders).then(([companyRes, partiesRes, productsRes, taxRatesRes, invoiceRes]) => {
      setCompany(companyRes.data.data);
      setParties(partiesRes.data.data.data);
      setProducts(productsRes.data.data.data);
      setTaxRates(taxRatesRes.data.data);

      if (invoiceRes) {
        const inv = invoiceRes.data.data;
        setInvoiceNo(inv.invoiceNo);
        setBuyerId(inv.buyer?._id || inv.buyer || '');
        setInvoiceDate(formatDateInput(inv.invoiceDate));
        setItems(
          inv.items.map((item) => ({
            _key: crypto.randomUUID(),
            product: item.product?._id || item.product || '',
            description: item.description,
            hsnSac: item.hsnSac,
            quantity: item.quantity,
            unit: item.unit,
            rate: item.rate,
            gstRate: reconstructGstRate(item, inv.hsnWiseBreakup),
          }))
        );
        setMoreFields({
          deliveryNote: inv.deliveryNote || '',
          modeOfPayment: inv.modeOfPayment || '',
          supplierRef: inv.supplierRef || '',
          otherReferences: inv.otherReferences || '',
          buyersOrderNo: inv.buyersOrderNo || '',
          despatchedThrough: inv.despatchedThrough || '',
          destination: inv.destination || '',
          termsOfDelivery: inv.termsOfDelivery || '',
        });
      }

      setLoading(false);
    });
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
      invoiceDate,
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
      ...moreFields,
    };

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = isEdit
        ? await invoiceApi.updateInvoice({ id, ...payload })
        : await invoiceApi.createInvoice(payload);
      toast.success(isEdit ? 'Invoice updated.' : 'Invoice created.');
      if (onSuccess) onSuccess(res.data.data);
      else navigate(`/invoices/${res.data.data._id}`);
    } catch {
      // toast already shown by the axios interceptor
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleCancel = () => (onCancel ? onCancel() : navigate('/invoices'));

  // Lets a brand-new customer be added without abandoning an in-progress invoice — see
  // understand.md's note on this (added 2026-09-15): before this, the Buyer dropdown only
  // offered existing parties, so a first-time customer meant leaving this form entirely
  // (losing every field already filled in), creating the party on its own page, then
  // starting the invoice over. Opening PartyForm in a Modal here keeps this form's state
  // untouched underneath; on success the new party is spliced into the in-memory list and
  // selected immediately, same as if it had already existed.
  const handlePartyCreated = (party) => {
    setParties((prev) => [...prev, party].sort((a, b) => a.name.localeCompare(b.name)));
    setBuyerId(party._id);
    setShowNewPartyModal(false);
  };

  // Escape cancels (Tally muscle memory); Ctrl+Enter saves — a safer modern stand-in
  // for Tally's Ctrl+A, since hijacking Ctrl+A here would break normal text-selection
  // inside the longer text fields (address, description).
  //
  // Escape is only handled here when this form is NOT embedded in a Modal (`onCancel`
  // absent — i.e. the standalone /invoices/new or /invoices/:id/edit route, which has no
  // Modal.jsx instance to fall back on). When it IS embedded, Modal.jsx's own stack-aware
  // window listener is the sole thing that closes it. This used to fire from both places
  // ("harmless to call twice," the old comment said) — true when only one Modal is open,
  // but not once modals can nest (added 2026-09-15: InvoiceForm can open a "New Party"
  // Modal on top of itself). This form's own onKeyDown fires during React's synthetic
  // bubble phase, which always runs *before* Modal.jsx's native `window` listener for the
  // same keypress — so calling onCancel() here unmounts (and stack-pops) the inner modal
  // early enough that the outer modal's listener sees itself as newly-topmost and closes
  // too, discarding whatever it held. Letting Modal.jsx own Escape exclusively when
  // embedded removes the race instead of trying to win it.
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
          Editing <strong>{invoiceNo}</strong> (draft)
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
          label="Invoice Date"
          type="date"
          value={invoiceDate}
          onChange={(e) => setInvoiceDate(e.target.value)}
          required
        />
      </div>

      {parties.length === 0 && (
        <p className="small muted">
          No buyer parties yet — add one from the Parties page first.
        </p>
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

      <InvoiceLineItems items={items} onChange={setItems} products={products} taxRates={taxRates} />

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
        <div className="stack" style={{ minWidth: 240, textAlign: 'right' }}>
          <div>
            Taxable Value: <span className="tabular-nums">{formatCurrency(totals.taxableValue)}</span>
          </div>
          {totals.isInterState ? (
            <div>
              IGST: <span className="tabular-nums">{formatCurrency(totals.igstAmount)}</span>
            </div>
          ) : (
            <>
              <div>
                CGST: <span className="tabular-nums">{formatCurrency(totals.cgstAmount)}</span>
              </div>
              <div>
                SGST: <span className="tabular-nums">{formatCurrency(totals.sgstAmount)}</span>
              </div>
            </>
          )}
          <div>
            Round Off: <span className="tabular-nums">{formatCurrency(totals.roundOff)}</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            Total: <span className="tabular-nums">{formatCurrency(totals.totalAmount)}</span>
          </div>
          {totals.taxableValue >= 50000 && <div className="badge badge-warning">E-Way Bill required</div>}
        </div>
      </div>

      <div className="row" style={{ marginTop: 20 }}>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Invoice'}
        </Button>
        <Button variant="secondary" type="button" onClick={handleCancel}>
          Cancel
        </Button>
      </div>

      {buyer && company && items.some((i) => i.description) && (
        <div style={{ marginTop: 30 }}>
          <h3>Preview</h3>
          <InvoicePreview invoice={{ items, invoiceDate }} company={company} party={buyer} totals={totals} />
        </div>
      )}

      <KeyboardHintBar
        hints={[
          { key: 'Enter', label: 'Next field / new row' },
          { key: 'Alt+D', label: 'Delete row' },
          { key: 'Alt+I', label: 'Insert row above' },
          { key: 'Ctrl+Enter', label: 'Save invoice' },
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
