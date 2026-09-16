// DatePicker.jsx — custom-styled date picker replacing the browser's native
// <input type="date"> calendar popup, which can't be restyled at all (its internals are
// closed to CSS) and looks nothing like the rest of this app's ledger/paper design system.
// Value in/out is still a plain 'yyyy-mm-dd' string — same contract as the native input it
// replaces — so callers don't need to change how they store it.
import { useEffect, useRef, useState } from 'react';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toValue(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseValue(value) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m: m - 1, d };
}

function formatDisplay(value) {
  const parsed = parseValue(value);
  if (!parsed) return '';
  return new Date(parsed.y, parsed.m, parsed.d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Builds a 6x7 grid of { day, month: 'prev'|'current'|'next', y, m, d } cells for the
// given year/month, always starting on Sunday — a fixed 6-row grid keeps the popup's
// height constant as the user pages between months instead of jumping around.
function buildGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) {
    const d = daysInPrevMonth - startOffset + 1 + i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    cells.push({ d, m, y, outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ d, m: month, y: year, outside: false });
  }
  while (cells.length < 42) {
    const d = cells.length - (startOffset + daysInMonth) + 1;
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    cells.push({ d, m, y, outside: true });
  }
  return cells;
}

export default function DatePicker({ label, value, onChange, placeholder = 'Select date' }) {
  const [open, setOpen] = useState(false);
  const parsed = parseValue(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState(parsed?.y ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.m ?? today.getMonth());
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    // Re-sync the visible month to the current value each time the popup opens, so
    // reopening it doesn't strand the user on whatever month they last paged to.
    setViewYear(parsed?.y ?? today.getFullYear());
    setViewMonth(parsed?.m ?? today.getMonth());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const goToMonth = (delta) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  };

  const selectDay = (cell) => {
    onChange(toValue(cell.y, cell.m, cell.d));
    setOpen(false);
  };

  const grid = buildGrid(viewYear, viewMonth);
  const isSelected = (cell) => parsed && cell.y === parsed.y && cell.m === parsed.m && cell.d === parsed.d;
  const isToday = (cell) =>
    cell.y === today.getFullYear() && cell.m === today.getMonth() && cell.d === today.getDate();

  return (
    <div className="field date-picker" style={{ marginBottom: 0 }} ref={rootRef}>
      {label && <label>{label}</label>}
      <button
        type="button"
        className="input date-picker-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? '' : 'muted'}>{value ? formatDisplay(value) : placeholder}</span>
        <svg className="date-picker-icon" width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M1.5 6H14.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M4.5 1V3.5M11.5 1V3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="date-picker-popup" role="dialog">
          <div className="date-picker-header">
            <button type="button" className="date-picker-nav" onClick={() => goToMonth(-1)} aria-label="Previous month">
              <svg width="8" height="12" viewBox="0 0 8 12" fill="none" aria-hidden="true">
                <path d="M7 1L2 6L7 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="date-picker-month-label">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button type="button" className="date-picker-nav" onClick={() => goToMonth(1)} aria-label="Next month">
              <svg width="8" height="12" viewBox="0 0 8 12" fill="none" aria-hidden="true">
                <path d="M1 1L6 6L1 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="date-picker-grid date-picker-weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="date-picker-grid">
            {grid.map((cell, i) => (
              <button
                type="button"
                key={i}
                className={[
                  'date-picker-day',
                  cell.outside ? 'outside' : '',
                  isSelected(cell) ? 'selected' : '',
                  isToday(cell) && !isSelected(cell) ? 'today' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => selectDay(cell)}
              >
                {cell.d}
              </button>
            ))}
          </div>

          <div className="date-picker-footer">
            <button
              type="button"
              className="btn btn-text"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn btn-text"
              onClick={() => {
                const t = new Date();
                onChange(toValue(t.getFullYear(), t.getMonth(), t.getDate()));
                setOpen(false);
              }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
