// auth.api.js — login/register calls
import axiosClient from './axiosClient.js';

export const login = (data) => axiosClient.post('/auth/login', data);
export const register = (data) => axiosClient.post('/auth/register', data);
export const refresh = () => axiosClient.post('/auth/refresh');
export const logout = () => axiosClient.post('/auth/logout');
