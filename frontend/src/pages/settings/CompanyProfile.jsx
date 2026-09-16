// CompanyProfile.jsx — Settings → Company Profile. Not listed in Section 5's file tree,
// but a necessary addition: company.controller.js's /companies/update endpoint — and the
// tagline/phone/email/website/bank-details fields the Classic invoice template actually
// renders — had no UI to reach them at all. (Logo/signature upload used to live here too
// — removed 2026-09-15, see understand.md.)
import { useEffect, useState } from 'react';
import * as companyApi from '../../api/company.api.js';
import Input from '../../components/common/Input.jsx';
import Button from '../../components/common/Button.jsx';
import Loader from '../../components/common/Loader.jsx';
import SettingsNav from '../../components/settings/SettingsNav.jsx';
import { toast } from '../../components/common/Toast.jsx';

const EMPTY_FORM = {
  name: '',
  tagline: '',
  address: '',
  gstin: '',
  stateName: '',
  stateCode: '',
  pan: '',
  phone: '',
  email: '',
  website: '',
  bankName: '',
  accountNo: '',
  branch: '',
  ifsc: '',
};

export default function CompanyProfile() {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = () => {
    setLoading(true);
    companyApi.getCompany().then((res) => {
      const c = res.data.data;
      setCompany(c);
      setForm({
        name: c.name || '',
        tagline: c.tagline || '',
        address: c.address || '',
        gstin: c.gstin || '',
        stateName: c.stateName || '',
        stateCode: c.stateCode || '',
        pan: c.pan || '',
        phone: c.phone || '',
        email: c.email || '',
        website: c.website || '',
        bankName: c.bankDetails?.bankName || '',
        accountNo: c.bankDetails?.accountNo || '',
        branch: c.bankDetails?.branch || '',
        ifsc: c.bankDetails?.ifsc || '',
      });
      setLoading(false);
    });
  };

  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Company name is required.');
      return;
    }
    if (!form.address.trim()) {
      toast.error('Address is required.');
      return;
    }
    if (!form.gstin.trim()) {
      toast.error('GSTIN is required.');
      return;
    }
    if (!form.stateName.trim()) {
      toast.error('State name is required.');
      return;
    }
    if (!form.stateCode.trim()) {
      toast.error('State code is required.');
      return;
    }
    setSaving(true);
    try {
      // Send every field as-is, including empty strings — a field the user cleared
      // must actually reach the backend as '' so it gets persisted as cleared, not
      // dropped from the request (which would silently leave the old value in place;
      // see the comment this replaced for the bug that caused).
      await companyApi.updateCompany({
        name: form.name,
        tagline: form.tagline,
        address: form.address,
        gstin: form.gstin,
        stateName: form.stateName,
        stateCode: form.stateCode,
        pan: form.pan,
        phone: form.phone,
        email: form.email,
        website: form.website,
        bankDetails: {
          bankName: form.bankName,
          accountNo: form.accountNo,
          branch: form.branch,
          ifsc: form.ifsc,
        },
      });
      toast.success('Company profile updated.');
      load();
    } catch {
      // toast already shown by the axios interceptor
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading company profile…" />;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
      </div>
      <SettingsNav />

      <form onSubmit={handleSubmit} style={{ maxWidth: 720 }}>
        <div className="form-grid">
          <Input
            id="name"
            label="Company Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            id="tagline"
            label="Tagline"
            value={form.tagline}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
          />
          <div className="form-row-full">
            <Input
              id="address"
              label="Address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <Input
            id="gstin"
            label="GSTIN"
            value={form.gstin}
            onChange={(e) => setForm({ ...form, gstin: e.target.value })}
          />
          <Input id="pan" label="PAN" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} />
          <Input
            id="stateName"
            label="State Name"
            value={form.stateName}
            onChange={(e) => setForm({ ...form, stateName: e.target.value })}
          />
          <Input
            id="stateCode"
            label="State Code"
            value={form.stateCode}
            onChange={(e) => setForm({ ...form, stateCode: e.target.value })}
          />
          <Input
            id="phone"
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            id="email"
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            id="website"
            label="Website"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
          />
        </div>

        <h3 style={{ marginTop: 24 }}>Bank Details</h3>
        <div className="form-grid">
          <Input
            id="bankName"
            label="Bank Name"
            value={form.bankName}
            onChange={(e) => setForm({ ...form, bankName: e.target.value })}
          />
          <Input
            id="accountNo"
            label="Account No."
            value={form.accountNo}
            onChange={(e) => setForm({ ...form, accountNo: e.target.value })}
          />
          <Input
            id="branch"
            label="Branch"
            value={form.branch}
            onChange={(e) => setForm({ ...form, branch: e.target.value })}
          />
          <Input
            id="ifsc"
            label="IFSC Code"
            value={form.ifsc}
            onChange={(e) => setForm({ ...form, ifsc: e.target.value })}
          />
        </div>

        <div className="row" style={{ marginTop: 20 }}>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
