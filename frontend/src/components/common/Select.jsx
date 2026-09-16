// Select.jsx — custom-styled dropdown replacing a native <select>, whose open options
// list (unlike the closed box, which already inherits .input styling fine) is entirely
// closed to CSS and always renders as raw OS/browser chrome — the same problem
// DatePicker.jsx solves for <input type="date">, same fix shape here.
//
// Scope: used for simple, useState-controlled filter/picker dropdowns (Invoices' status
// filter, Manage Masters' type filter). NOT used for react-hook-form-registered selects
// (PartyForm's Type, ProductForm's Unit/GST Rate) — those consume register()'s
// {name, onChange, onBlur, ref} directly, which would need react-hook-form's Controller to
// rewire onto a non-native control, and NOT used for InvoiceLineItems.jsx's Product/GST%
// selects, which deliberately rely on real native <select> behavior (native Enter-to-
// confirm, native type-to-jump) as part of the keyboard-first voucher-entry grid — see that
// file's own top comment. Extend those separately and carefully if this is ever wanted
// there too, rather than assuming this component is a drop-in replacement everywhere.
import { useEffect, useRef, useState } from 'react';

export default function Select({ label, value, onChange, options, placeholder = 'Select…' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((o) => o.value === value);

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

  const selectOption = (opt) => {
    onChange(opt.value);
    setOpen(false);
  };

  return (
    <div className="field custom-select" style={{ marginBottom: 0 }} ref={rootRef}>
      {label && <label>{label}</label>}
      <button
        type="button"
        className="input custom-select-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? '' : 'muted'}>{selected ? selected.label : placeholder}</span>
        <svg className="custom-select-icon" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="custom-select-popup" role="listbox">
          {options.map((opt) => (
            <button
              type="button"
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`custom-select-option${opt.value === value ? ' selected' : ''}`}
              onClick={() => selectOption(opt)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
