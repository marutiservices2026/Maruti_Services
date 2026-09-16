// EditInvoice.jsx — invoice edit page (draft invoices only — see the Edit button's
// status check in InvoiceDetail.jsx). InvoiceForm detects edit mode itself via the :id
// route param, so this page only supplies the standard .page wrapper.
import InvoiceForm from '../../components/invoice/InvoiceForm.jsx';

export default function EditInvoice() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Edit Invoice</h1>
      </div>
      <InvoiceForm />
    </div>
  );
}
