// TemplateGallery.jsx (page) — Settings → Invoice Template selection (Section 16)
import { useEffect, useState } from 'react';
import * as companyApi from '../../api/company.api.js';
import TemplateGallery from '../../components/settings/TemplateGallery.jsx';
import SettingsNav from '../../components/settings/SettingsNav.jsx';
import Loader from '../../components/common/Loader.jsx';

export default function TemplateGalleryPage() {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    companyApi
      .getCompany()
      .then((res) => setCompany(res.data.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !company) return <Loader label="Loading…" />;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
      </div>
      <SettingsNav />

      <h3>Invoice Template</h3>
      <TemplateGallery
        selectedKey={company.invoiceTemplate}
        onSaved={(key) => setCompany((c) => ({ ...c, invoiceTemplate: key }))}
      />
    </div>
  );
}
