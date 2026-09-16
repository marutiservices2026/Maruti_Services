// PartyForm.jsx — create/edit. Section 7 lists no /parties/detail endpoint (only
// list/create/update/delete), so an edit navigated from PartyList carries the record via
// router state (no extra fetch); a direct URL visit falls back to a filtered list call.
//
// Works two ways: as its own routed page (/parties/new, /parties/:id/edit — the
// default, when onCancel/onSuccess aren't passed), or embedded in a Modal from
// PartyList's "New Party" / Space shortcut, in which case it skips its own page
// chrome (the Modal already supplies a title) and calls the given callbacks instead of
// navigating — Modal.jsx's own Escape handling closes it either way.
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as partyApi from '../../api/party.api.js';
import Input from '../../components/common/Input.jsx';
import Button from '../../components/common/Button.jsx';
import Loader from '../../components/common/Loader.jsx';
import KeyboardHintBar from '../../components/common/KeyboardHintBar.jsx';
import { toast } from '../../components/common/Toast.jsx';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  address: z.string().min(1, 'Required'),
  gstin: z.string().optional(),
  stateName: z.string().min(1, 'Required'),
  stateCode: z.string().min(1, 'Required'),
  type: z.enum(['buyer', 'supplier', 'both']),
  phone: z.string().optional(),
  email: z.string().optional(),
});

export default function PartyForm({ onCancel, onSuccess }) {
  const embedded = Boolean(onCancel);
  const { id } = useParams();
  const location = useLocation();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(isEdit);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { type: 'buyer' } });

  useEffect(() => {
    if (!isEdit) return;

    const applyParty = (found) => {
      reset({
        name: found.name,
        address: found.address,
        gstin: found.gstin || '',
        stateName: found.stateName,
        stateCode: found.stateCode,
        type: found.type,
        phone: found.contactInfo?.phone || '',
        email: found.contactInfo?.email || '',
      });
      setLoading(false);
    };

    if (location.state?.party) {
      applyParty(location.state.party);
      return;
    }

    partyApi.listParties({ page: 1, limit: 200 }).then((res) => {
      const found = res.data.data.data.find((p) => p._id === id);
      if (found) applyParty(found);
      else setLoading(false);
    });
  }, [id, isEdit, location.state, reset]);

  const handleCancel = () => (onCancel ? onCancel() : navigate('/parties'));

  const onSubmit = async (data) => {
    // Every field is sent as-is, including empty strings — on an edit, a field the user
    // cleared must actually reach the backend as '' so it's persisted as cleared, not
    // dropped from the request (which would silently leave the old value in place).
    const payload = {
      name: data.name,
      address: data.address,
      gstin: data.gstin,
      stateName: data.stateName,
      stateCode: data.stateCode,
      type: data.type,
      contactInfo: { phone: data.phone, email: data.email },
    };
    try {
      let res;
      if (isEdit) {
        res = await partyApi.updateParty({ id, ...payload });
        toast.success('Party updated.');
      } else {
        res = await partyApi.createParty(payload);
        toast.success('Party created.');
      }
      if (onSuccess) onSuccess(res.data.data);
      else navigate('/parties');
    } catch {
      // toast already shown by the axios interceptor
    }
  };

  if (loading) return <Loader label="Loading party…" />;

  // Same Escape-cancels / Ctrl+Enter-saves convention as InvoiceForm — this form was
  // missing both the handling and the hint bar advertising it, which was inconsistent
  // with every other save-able form in the app (flagged in a 2026-09-15 UI/UX audit).
  // Escape only fires here when standalone (`embedded` false, no Modal.jsx wrapping it) —
  // when embedded, Modal.jsx's own stack-aware listener owns Escape exclusively. This form
  // can now be opened as a modal-within-a-modal (InvoiceForm's "+ New" party button), and
  // this form's own onKeyDown fires before Modal.jsx's window listener for the same
  // keypress; closing (and stack-popping) the inner modal that early made the outer modal
  // wrongly think it had become topmost and close too, discarding it — see InvoiceForm.jsx
  // for the full explanation of the race this avoids.
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
        <div className="field">
          <label htmlFor="type">Type</label>
          <select id="type" className="input" {...register('type')}>
            <option value="buyer">Buyer</option>
            <option value="supplier">Supplier</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div className="form-row-full">
          <Input label="Address" {...register('address')} error={errors.address?.message} />
        </div>
        <Input label="GSTIN" {...register('gstin')} error={errors.gstin?.message} />
        <div />
        <Input label="State Name" {...register('stateName')} error={errors.stateName?.message} />
        <Input label="State Code" {...register('stateCode')} error={errors.stateCode?.message} />
        <Input label="Phone" {...register('phone')} />
        <Input label="Email" type="email" {...register('email')} />
      </div>

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
          { key: 'Ctrl+Enter', label: 'Save party' },
          { key: 'Esc', label: 'Cancel' },
        ]}
      />
    </form>
  );

  if (embedded) return formEl;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{isEdit ? 'Edit Party' : 'New Party'}</h1>
      </div>
      {formEl}
    </div>
  );
}
