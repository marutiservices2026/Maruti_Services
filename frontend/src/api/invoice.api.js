// invoice.api.js — invoice CRUD + PDF calls
import axiosClient from './axiosClient.js';

export const listInvoices = (data = {}) => axiosClient.post('/invoices/list', data);
export const createInvoice = (data) => axiosClient.post('/invoices/create', data);
export const updateInvoice = (data) => axiosClient.post('/invoices/update', data);
export const deleteInvoice = (id) => axiosClient.post('/invoices/delete', { id });
// Reverts a finalized invoice back to 'draft' so it can go through updateInvoice again —
// admin-only, and logs the pre-unlock financial snapshot server-side (see
// invoice.controller.js's unlock).
export const unlockInvoice = (id, reason) => axiosClient.post('/invoices/unlock', { id, reason });
export const getInvoiceDetail = (id) => axiosClient.post('/invoices/detail', { id });
export const downloadInvoicePdf = (id) =>
  axiosClient.post('/invoices/pdf', { id }, { responseType: 'blob' });
