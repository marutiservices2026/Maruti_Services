// invoiceSlice.js — lightweight cache for parties/products used by the invoice form.
import { create } from 'zustand';

export const useInvoiceStore = create((set) => ({
  parties: [],
  products: [],
  setParties: (parties) => set({ parties }),
  setProducts: (products) => set({ products }),
}));
