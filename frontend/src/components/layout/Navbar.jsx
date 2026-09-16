// Navbar.jsx — top navbar. Shows the Backspace-to-go-back hint here (rather than in a
// page-specific KeyboardHintBar) since it's the one persistent element shown on every
// authenticated page regardless of which list/form is active.
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="topbar">
      <span className="small muted">
        <kbd>Backspace</kbd> Back
      </span>
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
