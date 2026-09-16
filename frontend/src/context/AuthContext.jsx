// AuthContext.jsx — auth bootstrap: on mount, attempts a silent token refresh via the
// httpOnly cookie so a page reload doesn't force a re-login while the refresh cookie is
// still valid. Ongoing auth state/actions are read via useAuth.js (backed by the
// Zustand store) — this context only gates initial render until bootstrap finishes.
import { createContext, useEffect, useState } from 'react';
import { useAuthStore } from '../store/authSlice.js';
import * as authApi from '../api/auth.api.js';

export const AuthContext = createContext({ ready: false });

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  useEffect(() => {
    if (accessToken) {
      setReady(true);
      return;
    }
    authApi
      .refresh()
      .then((res) => setAccessToken(res.data.data.accessToken))
      .catch(() => clearAuth())
      .finally(() => setReady(true));
    // Intentionally run once on mount only — this is a one-time bootstrap check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <span className="loader" />
      </div>
    );
  }

  return <AuthContext.Provider value={{ ready }}>{children}</AuthContext.Provider>;
}
