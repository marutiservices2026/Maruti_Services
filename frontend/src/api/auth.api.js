// auth.api.js — login/register calls
import axiosClient from './axiosClient.js';

export const login = (data) => axiosClient.post('/auth/login', data);
export const refresh = () => axiosClient.post('/auth/refresh');
export const logout = () => axiosClient.post('/auth/logout');
export const changePassword = (data) => axiosClient.post('/auth/change-password', data);
