// CreateQuotation.jsx — creation page for what the user sees as "Separate Bill" (renamed
// 2026-09-17, internal naming unchanged — see Sidebar.jsx's comment).
import QuotationForm from '../../components/quotation/QuotationForm.jsx';

export default function CreateQuotation() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>New Separate Bill</h1>
      </div>
      <QuotationForm />
    </div>
  );
}
