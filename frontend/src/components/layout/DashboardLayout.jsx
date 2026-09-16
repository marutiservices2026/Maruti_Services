// DashboardLayout.jsx — sidebar + content shell.
// Alt+1..8 jump straight to the matching sidebar section (Ctrl+1..9 is reserved by
// Chrome/Firefox/Edge for tab switching and can't be intercepted by a page, so Alt is
// the shortcut namespace that actually works — see Sidebar.jsx's SIDEBAR_LINKS, the
// single source of truth both the visible nav and this listener read from).
// Backspace goes back one step in history (same as the browser's own back button),
// guarded like Space: not while typing, and not while a modal is open (Escape owns
// closing that — firing history.back() underneath an open modal would navigate the
// page away while the modal's React state stuck around, orphaned).
//
// The "Space opens a new-entry form" shortcut lives in each list page itself via
// hooks/useSpaceShortcut.js, not here — only the page owns the modal state that needs
// to open.
import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar, { SIDEBAR_LINKS } from './Sidebar.jsx';
import Navbar from './Navbar.jsx';
import { isInteractive } from '../../utils/domFocus.js';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Client-side navigation never moves DOM focus on its own, so whatever link was last
  // actually clicked (or Alt-jumped to) keeps focus indefinitely — even after the route
  // has moved on. That's stale for screen readers in general, and concretely breaks
  // useSpaceShortcut's guard on the new page: it sees document.activeElement is still
  // that old <a>, correctly assumes something interactive has focus, and refuses to
  // fire. Blurring on every route change resets focus to a neutral state instead.
  useEffect(() => {
    document.activeElement?.blur();
  }, [location.pathname]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const index = Number(e.key) - 1;
        const link = SIDEBAR_LINKS[index];
        if (link) {
          e.preventDefault();
          navigate(link.to);
        }
        return;
      }

      if (
        e.key === 'Backspace' &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !isInteractive(document.activeElement) &&
        !document.querySelector('.modal-overlay')
      ) {
        e.preventDefault();
        navigate(-1);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="content">
        <Navbar />
        <Outlet />
      </div>
    </div>
  );
}
