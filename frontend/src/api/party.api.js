// party.api.js — party CRUD calls
import axiosClient from './axiosClient.js';

export const listParties = (data = {}) => axiosClient.post('/parties/list', data);
export const createParty = (data) => axiosClient.post('/parties/create', data);
export const updateParty = (data) => axiosClient.post('/parties/update', data);
export const deleteParty = (id) => axiosClient.post('/parties/delete', { id });
