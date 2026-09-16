// ewaybill.api.js — manual e-way bill entry (Section 1, 14)
import axiosClient from './axiosClient.js';

export const listEwayBills = (data = {}) => axiosClient.post('/ewaybills/list', data);
export const createEwayBill = (data) => axiosClient.post('/ewaybills/create', data);

export const parseEwayBillDocument = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return axiosClient.post('/ewaybills/parse', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
