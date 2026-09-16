// ConfirmDialog.jsx — promise-based confirm modal, replacing window.confirm everywhere in
// this app (native confirm() blocks the whole tab, can't be styled, and reads as "the app
// froze" to anything driving the page programmatically — see understand.md §6). Mirrors
// Toast.jsx's singleton emit/listener pattern so it's usable from any event handler with
// zero setup: `const ok = await confirmDialog({ message: '...' }); if (!ok) return;`
import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';

let resolveCurrent = null;
let listener = null;

export function confirmDialog({
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
} = {}) {
  return new Promise((resolve) => {
    resolveCurrent = resolve;
    listener?.({ title, message, confirmLabel, cancelLabel, danger });
  });
}

export function ConfirmDialogHost() {
  const [state, setState] = useState(null);

  useEffect(() => {
    listener = (s) => setState(s);
    return () => {
      listener = null;
    };
  }, []);

  const settle = (result) => {
    setState(null);
    resolveCurrent?.(result);
    resolveCurrent = null;
  };

  return (
    <Modal open={Boolean(state)} onClose={() => settle(false)} title={state?.title}>
      {state && (
        <>
          {state.message && <p style={{ marginTop: 0 }}>{state.message}</p>}
          <div className="row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => settle(false)}>
              {state.cancelLabel}
            </Button>
            <Button variant={state.danger ? 'danger' : 'primary'} onClick={() => settle(true)}>
              {state.confirmLabel}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
