// ProductForm.jsx — create/edit. Same /products/detail gap as parties (Section 7 lists
// no such endpoint) — router state from ProductList, with a list-scan fallback.
//
// Works two ways: as its own routed page (the default), or embedded in a Modal from
// ProductList's "New Product" / Space shortcut — see PartyForm.jsx for the identical
// pattern and rationale.
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as productApi from '../../api/product.api.js';
import * as masterApi from '../../api/master.api.js';
import Input from '../../components/common/Input.jsx';
import Button from '../../components/common/Button.jsx';
import Loader from '../../components/common/Loader.jsx';
import KeyboardHintBar from '../../components/common/KeyboardHintBar.jsx';
import { toast } from '../../components/common/Toast.jsx';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  hsnSac: z.string().min(1, 'Required'),
  unit: z.string().min(1, 'Required'),
  defaultRate: z.coerce.number().nonnegative('Must be 0 or more'),
  gstRate: z.string().min(1, 'Required'),
  category: z.string().optional(),
});

export default function ProductForm({ onCancel, onSuccess }) {
  const embedded = Boolean(onCancel);
  const { id } = useParams();
  const location = useLocation();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(isEdit);
  const [units, setUnits] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [pendingProduct, setPendingProduct] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    masterApi.listMasters({ type: 'unit' }).then((res) => setUnits(res.data.data));
    masterApi.listMasters({ type: 'taxRate' }).then((res) => setTaxRates(res.data.data));
  }, []);

  useEffect(() => {
    if (!isEdit) return;

    if (location.state?.product) {
      setPendingProduct(location.state.product);
      return;
    }

    productApi.listProducts({ page: 1, limit: 200 }).then((res) => {
      const found = res.data.data.data.find((p) => p._id === id);
      if (found) setPendingProduct(found);
      else setLoading(false);
    });
  }, [id, isEdit, location.state]);

  // The Unit/GST Rate <select> options come from a separate masters fetch that can
  // resolve after (or before) the product itself loads. reset() only sticks a select's
  // value if the matching <option> is already in the DOM, so re-apply it whenever units
  // or taxRates change too, not just when the product arrives — otherwise whichever
  // fetch wins the race leaves those two dropdowns stuck on the placeholder.
  useEffect(() => {
    if (!pendingProduct) return;
    reset({
      name: pendingProduct.name,
      hsnSac: pendingProduct.hsnSac,
      unit: pendingProduct.unit?._id || pendingProduct.unit,
      defaultRate: pendingProduct.defaultRate,
      gstRate: pendingProduct.gstRate?._id || pendingProduct.gstRate,
      category: pendingProduct.category || '',
    });
    setLoading(false);
  }, [pendingProduct, units, taxRates, reset]);

  const handleCancel = () => (onCancel ? onCancel() : navigate('/products'));

  const onSubmit = async (data) => {
    try {
      let res;
      if (isEdit) {
        res = await productApi.updateProduct({ id, ...data });
        toast.success('Product updated.');
      } else {
        res = await productApi.createProduct(data);
        toast.success('Product created.');
      }
      if (onSuccess) onSuccess(res.data.data);
      else navigate('/products');
    } catch {
      // toast already shown by the axios interceptor
    }
  };

  if (loading) return <Loader label="Loading product…" />;

  // Escape only fires here when standalone (`embedded` false) — when embedded in a Modal,
  // Modal.jsx's own stack-aware listener owns Escape exclusively. See PartyForm.jsx /
  // InvoiceForm.jsx for why: this form's own onKeyDown fires before Modal.jsx's window
  // listener for the same keypress, and closing the inner modal that early (if this form
  // is ever opened as a modal-within-a-modal) would pop the stack too soon and make an
  // outer modal wrongly close too.
  const submitForm = handleSubmit(onSubmit);
  const handleFormKeyDown = (e) => {
    if (e.key === 'Escape' && !embedded) {
      e.preventDefault();
      handleCancel();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submitForm(e);
    }
  };

  const formEl = (
    <form onSubmit={submitForm} onKeyDown={handleFormKeyDown} style={{ maxWidth: embedded ? '100%' : 640 }}>
      <div className="form-grid">
        <Input label="Name" {...register('name')} error={errors.name?.message} />
        <Input label="HSN/SAC" {...register('hsnSac')} error={errors.hsnSac?.message} />

        <div className="field">
          <label htmlFor="unit">Unit</label>
          <select id="unit" className="input" {...register('unit')}>
            <option value="">Select…</option>
            {units.map((u) => (
              <option key={u._id} value={u._id}>
                {u.label}
              </option>
            ))}
          </select>
          {errors.unit && <div className="field-error">{errors.unit.message}</div>}
        </div>

        <div className="field">
          <label htmlFor="gstRate">GST Rate</label>
          <select id="gstRate" className="input" {...register('gstRate')}>
            <option value="">Select…</option>
            {taxRates.map((r) => (
              <option key={r._id} value={r._id}>
                {r.label}
              </option>
            ))}
          </select>
          {errors.gstRate && <div className="field-error">{errors.gstRate.message}</div>}
        </div>

        <Input
          label="Default Rate"
          type="number"
          step="0.01"
          className="numeric"
          {...register('defaultRate')}
          error={errors.defaultRate?.message}
        />
        <Input label="Category" {...register('category')} />
      </div>

      {units.length === 0 && (
        <p className="small muted">
          No units defined yet — add one in Settings → Manage Masters before creating a product.
        </p>
      )}
      {taxRates.length === 0 && (
        <p className="small muted">
          No GST rates defined yet — add one in Settings → Manage Masters (type: GST Rate) before
          creating a product.
        </p>
      )}

      <div className="row" style={{ marginTop: 20 }}>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="secondary" type="button" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
      <KeyboardHintBar
        hints={[
          { key: 'Ctrl+Enter', label: 'Save product' },
          { key: 'Esc', label: 'Cancel' },
        ]}
      />
    </form>
  );

  if (embedded) return formEl;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{isEdit ? 'Edit Product' : 'New Product'}</h1>
      </div>
      {formEl}
    </div>
  );
}
