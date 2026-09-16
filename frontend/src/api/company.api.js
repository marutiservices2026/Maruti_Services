// company.api.js — company profile, template selection. (Logo/signature upload used to
// live here too — removed 2026-09-15, see understand.md.)
import axiosClient from './axiosClient.js';

export const getCompany = () => axiosClient.post('/companies/detail', {});
export const updateCompany = (data) => axiosClient.post('/companies/update', data);
export const setTemplate = (data) => axiosClient.post('/companies/set-template', data);
