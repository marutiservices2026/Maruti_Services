// AppRoutes.jsx — top-level route definitions. Routes are code-split with React.lazy +
// Suspense (Section 8).
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute.jsx';
import DashboardLayout from '../components/layout/DashboardLayout.jsx';
import Loader from '../components/common/Loader.jsx';

const Login = lazy(() => import('../pages/auth/Login.jsx'));
const Dashboard = lazy(() => import('../pages/dashboard/Dashboard.jsx'));
const PartyList = lazy(() => import('../pages/parties/PartyList.jsx'));
const PartyForm = lazy(() => import('../pages/parties/PartyForm.jsx'));
const ProductList = lazy(() => import('../pages/products/ProductList.jsx'));
const ProductForm = lazy(() => import('../pages/products/ProductForm.jsx'));
const InvoiceList = lazy(() => import('../pages/invoices/InvoiceList.jsx'));
const CreateInvoice = lazy(() => import('../pages/invoices/CreateInvoice.jsx'));
const EditInvoice = lazy(() => import('../pages/invoices/EditInvoice.jsx'));
const InvoiceDetail = lazy(() => import('../pages/invoices/InvoiceDetail.jsx'));
const EwayBillTracker = lazy(() => import('../pages/ewaybill/EwayBillTracker.jsx'));
const CompanyProfile = lazy(() => import('../pages/settings/CompanyProfile.jsx'));
const ManageMasters = lazy(() => import('../pages/settings/ManageMasters.jsx'));
const TemplateGallerySettings = lazy(() => import('../pages/settings/TemplateGallery.jsx'));

// This outer boundary only actually fires for lazy chunks that DashboardLayout's own
// inner Suspense (see DashboardLayout.jsx) can't catch — /login's chunk (rendered outside
// DashboardLayout entirely) and the very first app load before any route has mounted. Full
// viewport, not `.page`-scoped, since at this point there's no sidebar/card context to sit
// inside yet — this is what a user sees before the app has decided what to show them.
function PageFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-paper-white)',
      }}
    >
      <Loader label="Loading…" />
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/parties" element={<PartyList />} />
            <Route path="/parties/new" element={<PartyForm />} />
            <Route path="/parties/:id/edit" element={<PartyForm />} />
            <Route path="/products" element={<ProductList />} />
            <Route path="/products/new" element={<ProductForm />} />
            <Route path="/products/:id/edit" element={<ProductForm />} />
            <Route path="/invoices" element={<InvoiceList />} />
            <Route path="/invoices/new" element={<CreateInvoice />} />
            <Route path="/invoices/:id/edit" element={<EditInvoice />} />
            <Route path="/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/ewaybills" element={<EwayBillTracker />} />
            <Route path="/settings/company" element={<CompanyProfile />} />
            <Route path="/settings/masters" element={<ManageMasters />} />
            <Route path="/settings/templates" element={<TemplateGallerySettings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
