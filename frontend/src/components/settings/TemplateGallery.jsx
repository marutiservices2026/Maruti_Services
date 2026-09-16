// TemplateGallery.jsx — pick invoice layout (Section 16). Section 16 also describes a
// live preview pane rendering the company's real details inside the chosen template;
// the given endpoint set (/templates/list, /companies/set-template) has no "render with
// sample data" endpoint, so the true pixel-perfect preview lives on the actual invoice
// detail page's PDF download instead — this gallery focuses on clear descriptions and
// selection, which is what these endpoints actually support.
import { useEffect, useState } from 'react';
import * as templateApi from '../../api/template.api.js';
import * as companyApi from '../../api/company.api.js';
import TemplatePreviewCard from './TemplatePreviewCard.jsx';
import Loader from '../common/Loader.jsx';
import { toast } from '../common/Toast.jsx';

export default function TemplateGallery({ selectedKey, onSaved }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    templateApi
      .listTemplates('invoice')
      .then((res) => setTemplates(res.data.data))
      .finally(() => setLoading(false));
  }, []);

  const select = async (key) => {
    if (saving || key === selectedKey) return;
    setSaving(true);
    try {
      await companyApi.setTemplate({ invoiceTemplate: key });
      toast.success('Template preference saved.');
      onSaved?.(key);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading templates…" />;

  return (
    <div className="template-gallery">
      {templates.map((t) => (
        <TemplatePreviewCard key={t.key} template={t} selected={t.key === selectedKey} onSelect={() => select(t.key)} />
      ))}
    </div>
  );
}
