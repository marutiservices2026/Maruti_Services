// Sidebar.jsx — fixed Ink Navy sidebar nav (Section 15). Exports SIDEBAR_LINKS so
// DashboardLayout.jsx's Alt+1..6 shortcuts stay in sync with what's actually shown —
// one array drives both. Reports was folded directly into Dashboard.jsx (2026-09-14) —
// no separate nav item, one less click to see how the business is doing.
import { NavLink } from 'react-router-dom';

export const SIDEBAR_LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/invoices', label: 'Invoices' },
  { to: '/parties', label: 'Parties' },
  { to: '/products', label: 'Products' },
  { to: '/ewaybills', label: 'E-Way Bills' },
  { to: '/settings/company', label: 'Settings' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <img src="/favicon-48x48.png" alt="" width="24" height="24" />
        </span>
        <span>Maruti Packaging</span>
      </div>
      <nav>
        {SIDEBAR_LINKS.map((link, index) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            <span>{link.label}</span>
            <kbd className="nav-shortcut">Alt+{index + 1}</kbd>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
