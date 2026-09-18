// quotation.api.js — quotation CRUD + PDF + convert-to-invoice calls
import axiosClient from './axiosClient.js';

export const listQuotations = (data = {}) => axiosClient.post('/quotations/list', data);
export const createQuotation = (data) => axiosClient.post('/quotations/create', data);
export const updateQuotation = (data) => axiosClient.post('/quotations/update', data);
export const deleteQuotation = (id) => axiosClient.post('/quotations/delete', { id });
export const hardDeleteQuotation = (id) => axiosClient.post('/quotations/hard-delete', { id });
export const bulkDeleteQuotations = (ids) => axiosClient.post('/quotations/bulk-delete', { ids });
export const getQuotationDetail = (id) => axiosClient.post('/quotations/detail', { id });
export const convertToInvoice = (id) => axiosClient.post('/quotations/convert', { id });
export const downloadQuotationPdf = (id) =>
  axiosClient.post('/quotations/pdf', { id }, { responseType: 'blob' });
