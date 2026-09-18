// EditQuotation.jsx — edit page for what the user sees as "Separate Bill" (renamed
// 2026-09-17, internal naming unchanged — see Sidebar.jsx's comment). Only reachable for
// 'open' ones — see the Edit button's status check in QuotationDetail.jsx. QuotationForm
// detects edit mode itself via the :id route param, same pattern as EditInvoice.jsx.
import QuotationForm from '../../components/quotation/QuotationForm.jsx';

export default function EditQuotation() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Edit Separate Bill</h1>
      </div>
      <QuotationForm />
    </div>
  );
}
