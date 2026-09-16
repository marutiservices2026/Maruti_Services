// Toast.jsx — minimal toast/notification system (Section 10: "Axios response
// interceptor ... shows a toast/notification with the server's message"). Not listed
// as its own file in Section 5's tree, but the toast requirement has no other home —
// added as the smallest possible addition to components/common/, matching its siblings.
import { useEffect, useState } from 'react';

let idCounter = 0;
const listeners = new Set();

function emit(t) {
  listeners.forEach((fn) => fn(t));
}

export const toast = {
  success: (message) => emit({ id: ++idCounter, type: 'success', message }),
  error: (message) => emit({ id: ++idCounter, type: 'error', message }),
  info: (message) => emit({ id: ++idCounter, type: 'info', message }),
};

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 4000);
    };
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
