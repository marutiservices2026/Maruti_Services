// invoice.api.js — invoice CRUD + PDF calls
import axiosClient from './axiosClient.js';

export const listInvoices = (data = {}) => axiosClient.post('/invoices/list', data);
export const createInvoice = (data) => axiosClient.post('/invoices/create', data);
export const updateInvoice = (data) => axiosClient.post('/invoices/update', data);
export const deleteInvoice = (id) => axiosClient.post('/invoices/delete', { id });
export const getInvoiceDetail = (id) => axiosClient.post('/invoices/detail', { id });
export const downloadInvoicePdf = (id) =>
  axiosClient.post('/invoices/pdf', { id }, { responseType: 'blob' });
