// Sidebar.jsx — fixed Ink Navy sidebar nav (Section 15). Exports SIDEBAR_LINKS so
// DashboardLayout.jsx's Alt+1..6 shortcuts stay in sync with what's actually shown —
// one array drives both. Reports was folded directly into Dashboard.jsx (2026-09-14) —
// no separate nav item, one less click to see how the business is doing.
import { NavLink } from 'react-router-dom';

export const SIDEBAR_LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/invoices', label: 'Invoices' },
  // Shown to the user as "Separate Bills" (the label, changed 2026-09-17 at the user's
  // request) — the route/internal naming stays "quotations" throughout the codebase, since
  // that's invisible to the user; only the displayed text changed. Deliberately its own
  // top-level nav item, not a tab/filter under Invoices — see Quotation.model.js's header
  // comment: it's not a tax document and isn't part of the invoice sequence/reports at
  // all, so it shouldn't look like a sub-view of Invoices either.
  { to: '/quotations', label: 'Separate Bills' },
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
