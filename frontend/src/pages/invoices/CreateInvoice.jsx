// CreateInvoice.jsx — invoice creation page
import InvoiceForm from '../../components/invoice/InvoiceForm.jsx';

export default function CreateInvoice() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>New Invoice</h1>
      </div>
      <InvoiceForm />
    </div>
  );
}
