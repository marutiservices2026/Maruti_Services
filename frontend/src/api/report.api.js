// report.api.js — sales register + GST summary calls
import axiosClient from './axiosClient.js';

export const salesRegister = (data = {}) => axiosClient.post('/reports/sales-register', data);
export const gstSummary = (data = {}) => axiosClient.post('/reports/gst-summary', data);
