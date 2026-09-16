// Modal.jsx — shared Modal component. Escape closes it via a `window` keydown listener,
// which is the SOLE way Escape closes a Modal — embedded form content (InvoiceForm,
// PartyForm, ProductForm) deliberately does NOT also call onCancel on Escape when it's
// embedded (only on their standalone routed pages, which have no Modal to fall back on).
// A form's own onKeyDown fires during React's synthetic bubble phase, which always runs
// *before* this native `window` listener for the same keypress — if the form also closed
// itself on Escape while embedded, that early close (see the stacking note below) could
// pop this Modal off `modalStack` before an *outer* Modal's own listener gets a chance to
// check whether it's still topmost, wrongly making the outer one close too. Letting Modal
// own Escape exclusively when embedded avoids that race instead of trying to win it — see
// each form's own comment on this for the concrete case that surfaced it.
// `size="lg"` widens it for content that needs real horizontal room, like the invoice
// line-item grid.
//
// Modals can now stack (e.g. InvoiceForm opens a "New Party" Modal on top of itself when
// InvoiceForm is already being shown inside InvoiceList's "New Invoice" Modal — added
// 2026-09-15, see understand.md). `modalStack` tracks which Modal instances are currently
// open, in open-order; Escape and an overlay click only ever close the *topmost* one — an
// un-scoped `window` keydown listener per instance would otherwise fire for every open
// Modal at once, closing the outer one too and discarding whatever it held (the exact
// data-loss bug the New Party modal exists to prevent).
import { useEffect, useRef } from 'react';

let modalStack = [];
let idCounter = 0;

export default function Modal({ open, onClose, title, size = 'md', children }) {
  const idRef = useRef(++idCounter);

  useEffect(() => {
    if (!open) return;
    modalStack.push(idRef.current);
    return () => {
      modalStack = modalStack.filter((id) => id !== idRef.current);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === idRef.current) {
        e.preventDefault();
        onClose?.();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        // Without this, a backdrop click on the topmost modal still bubbles to any
        // Modal it's nested inside (they share the same DOM tree, just stacked
        // visually), closing that one too.
        e.stopPropagation();
        onClose?.();
      }}
    >
      <div
        className={`modal ${size === 'lg' ? 'modal-lg' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn btn-text" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
