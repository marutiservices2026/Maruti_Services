// master.api.js — Tally-style master data CRUD (units, tax rates, voucher types, payment
// terms, states). Was combined with FieldConfig (custom fields) calls in fieldConfig.api.js
// until the custom-fields subsystem was removed 2026-09-15 — see understand.md.
import axiosClient from './axiosClient.js';

export const listMasters = (data) => axiosClient.post('/masters/list', data);
export const createMaster = (data) => axiosClient.post('/masters/create', data);
export const updateMaster = (data) => axiosClient.post('/masters/update', data);
export const deleteMaster = (id) => axiosClient.post('/masters/delete', { id });
