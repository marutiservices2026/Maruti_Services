// SettingsNav.jsx — sub-navigation tabs across the Settings pages. Not in Section 5's
// file tree, but a necessary addition: Sidebar.jsx only links to one of these pages, so
// without this, Manage Masters, Templates, and Company Profile were only reachable by
// typing a URL directly. "Manage Fields" (custom fields / FieldConfig) used to be a
// fourth tab here — removed 2026-09-15, see understand.md: it was never actually used
// (zero FieldConfig documents ever existed across the app's real data).
import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/settings/company', label: 'Company Profile' },
  { to: '/settings/masters', label: 'Manage Masters' },
  { to: '/settings/templates', label: 'Templates' },
];

export default function SettingsNav() {
  return (
    <div className="settings-nav">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
