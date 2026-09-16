// useAuth.js — auth state/actions hook, backed by store/authSlice.js
import { useAuthStore } from '../store/authSlice.js';
import * as authApi from '../api/auth.api.js';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const login = async (email, password) => {
    const res = await authApi.login({ email, password });
    setAuth(res.data.data.user, res.data.data.accessToken);
    return res.data.data.user;
  };

  const register = async (payload) => {
    const res = await authApi.register(payload);
    setAuth(res.data.data.user, res.data.data.accessToken);
    return res.data.data.user;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      clearAuth();
    }
  };

  return {
    user,
    isAuthenticated: Boolean(accessToken && user),
    login,
    register,
    logout,
  };
}
