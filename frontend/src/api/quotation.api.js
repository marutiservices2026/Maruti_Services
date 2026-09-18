// quotation.api.js — quotation CRUD + PDF + convert-to-invoice calls
import axiosClient from './axiosClient.js';

export const listQuotations = (data = {}) => axiosClient.post('/quotations/list', data);
export const createQuotation = (data) => axiosClient.post('/quotations/create', data);
export const updateQuotation = (data) => axiosClient.post('/quotations/update', data);
export const deleteQuotation = (id) => axiosClient.post('/quotations/delete', { id });
// Soft delete (hides from the list, data stays retrievable by direct lookup — see
// quotation.controller.js's softDelete/bulkSoftDelete) — named to match, not "hard".
export const softDeleteQuotation = (id) => axiosClient.post('/quotations/soft-delete', { id });
export const bulkSoftDeleteQuotations = (ids) =>
  axiosClient.post('/quotations/bulk-soft-delete', { ids });
export const getQuotationDetail = (id) => axiosClient.post('/quotations/detail', { id });
export const convertToInvoice = (id) => axiosClient.post('/quotations/convert', { id });
export const downloadQuotationPdf = (id) =>
  axiosClient.post('/quotations/pdf', { id }, { responseType: 'blob' });
