// template.api.js — invoice template gallery listing (Section 16)
import axiosClient from './axiosClient.js';

export const listTemplates = (documentType) => axiosClient.post('/templates/list', { documentType });
