// axiosClient.js — base Axios instance, interceptors, token refresh (Section 8, 10).
// Catches all API errors in one place: shows a toast with the server's message,
// redirects to login on an unrecoverable 401, and never dumps a raw stack to the UI.
import axios from 'axios';
import { useAuthStore } from '../store/authSlice.js';
import { toast } from '../components/common/Toast.jsx';
import { formatApiErrorMessage } from '../utils/apiError.js';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true, // send the httpOnly refresh cookie
});

axiosClient.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise = null;

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const isAuthRoute = config?.url?.includes('/auth/');

    if (response?.status === 401 && config && !config._retried && !isAuthRoute) {
      config._retried = true;
      try {
        if (!refreshPromise) {
          refreshPromise = axiosClient.post('/auth/refresh').finally(() => {
            refreshPromise = null;
          });
        }
        const refreshRes = await refreshPromise;
        const newToken = refreshRes.data.data.accessToken;
        useAuthStore.getState().setAccessToken(newToken);
        config.headers.Authorization = `Bearer ${newToken}`;
        return axiosClient(config);
      } catch {
        useAuthStore.getState().clearAuth();
        // .replace(), not a plain href assignment — this is a hard, full-page navigation
        // (it runs outside React Router entirely, since axios interceptors have no router
        // context), and .href= would push a brand-new history entry that no SPA-level
        // navigate({replace:true}) fix (see Login.jsx, Navbar.jsx) can ever remove — it's a
        // completely separate mechanism. .replace() is the hard-navigation equivalent of
        // history.replaceState: it swaps the current entry instead of adding one.
        window.location.replace('/login');
        return Promise.reject(error);
      }
    }

    // The silent-refresh call's own 401 (no refresh cookie — an expected state right
    // after logout or an expired session, not a real error) already leads to a redirect
    // to /login above; surfacing its raw backend message ("Refresh token missing.") as a
    // toast on top of that redirect is just implementation detail leaking through.
    const isRefreshRoute = config?.url?.includes('/auth/refresh');
    if (!isRefreshRoute) {
      toast.error(formatApiErrorMessage(response?.data));
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
