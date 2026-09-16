// authSlice.js — auth store slice (Zustand). Persists accessToken + user to
// localStorage — the refresh token lives only in the backend's httpOnly cookie and is
// never touched by JS (Section 3, 9).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: (user, accessToken) => set({ user, accessToken }),
      setAccessToken: (accessToken) => set({ accessToken }),
      clearAuth: () => set({ user: null, accessToken: null }),
    }),
    { name: 'gst-billing-auth' }
  )
);
