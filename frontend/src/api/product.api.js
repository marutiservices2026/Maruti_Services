// product.api.js — product CRUD calls
import axiosClient from './axiosClient.js';

export const listProducts = (data = {}) => axiosClient.post('/products/list', data);
export const createProduct = (data) => axiosClient.post('/products/create', data);
export const updateProduct = (data) => axiosClient.post('/products/update', data);
export const deleteProduct = (id) => axiosClient.post('/products/delete', { id });
