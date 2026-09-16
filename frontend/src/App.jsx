// App.jsx
import { Component } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastContainer } from './components/common/Toast.jsx';
import { ConfirmDialogHost } from './components/common/ConfirmDialog.jsx';
import AppRoutes from './routes/AppRoutes.jsx';

// Top-level Error Boundary (Section 10) — a rendering bug in one page (e.g. a
// malformed dynamic field) shows a plain fallback instead of a blank white page. Must
// be a class component; React has no hook equivalent for error boundaries, and there's
// no dedicated file for this in Section 5's tree, so it lives inline here.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled rendering error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p className="muted">Please refresh the page. If the problem continues, contact support.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <ToastContainer />
          <ConfirmDialogHost />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
