// Navbar.jsx — top navbar. Shows the Backspace-to-go-back hint here (rather than in a
// page-specific KeyboardHintBar) since it's the one persistent element shown on every
// authenticated page regardless of which list/form is active.
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    // replace, not push — same reasoning as Login.jsx's post-login redirect: leaving
    // the just-ended session's last authenticated page sitting one "back" step behind
    // /login means Backspace (or the browser's own back button) could return to a page
    // that immediately bounces you right back to /login via ProtectedRoute anyway.
    navigate('/login', { replace: true });
  };

  return (
    <header className="topbar">
      {/* Dashboard ("/") has no sensible "back" — DashboardLayout.jsx disables the
          Backspace shortcut there, so don't advertise it either. */}
      {location.pathname !== '/' && (
        <span className="small muted">
          <kbd>Backspace</kbd> Back
        </span>
      )}
      <div className="row">
        <span className="small muted">
          {user?.name} ({user?.role})
        </span>
        <button className="btn btn-text" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </header>
  );
}
