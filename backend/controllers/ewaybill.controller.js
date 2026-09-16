// ewaybill.controller.js — manual e-way bill entry (Section 1, 7, 14). Direct GSTN
// e-Way Bill API integration needs a GSP account and is out of scope for v1 — this just
// tracks the number the client generated themselves on the government portal, for
// sales invoices.
import { z } from 'zod';
import * as methods from '../methods.js';
import EwayBill from '../models/EwayBill.model.js';
import Invoice from '../models/Invoice.model.js';
import * as ewaybillOcrService from '../services/ewaybillOcr.service.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const listEwayBillSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
});

export const createEwayBillSchema = z.object({
  invoice: z.string().min(1),
  ewbNo: z.string().min(1),
  generatedDate: z.coerce.date(),
  validUpto: z.coerce.date().optional(),
  vehicleNo: z.string().optional(),
  transporterName: z.string().optional(),
  distance: z.number().nonnegative().optional(),
});

// POST /ewaybills/list
export const list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.body;
  const result = await methods.paginate(EwayBill, { company: req.user.company }, page, limit, {
    sort: { generatedDate: -1 },
    populate: ['invoice'],
  });
  return new ApiResponse(200, result).send(res);
});

// POST /ewaybills/create — manual entry of e-way bill number once generated on govt portal
export const create = asyncHandler(async (req, res) => {
  const invoice = await methods.findOne(Invoice, { _id: req.body.invoice, company: req.user.company });
  if (!invoice) throw ApiError.badRequest('Invoice not found.');

  const ewayBill = await methods.create(EwayBill, {
    company: req.user.company,
    invoice: req.body.invoice,
    ewbNo: req.body.ewbNo,
    generatedDate: req.body.generatedDate,
    validUpto: req.body.validUpto,
    vehicleNo: req.body.vehicleNo,
    transporterName: req.body.transporterName,
    distance: req.body.distance,
  });

  // Keep the source invoice's ewayBillNo in sync so its list/detail/PDF views reflect it.
  await methods.updateById(Invoice, req.body.invoice, { ewayBillNo: req.body.ewbNo });

  return new ApiResponse(201, ewayBill, 'E-way bill recorded.').send(res);
});

// POST /ewaybills/parse — multipart, field "file". Reads the uploaded e-Way Bill
// document (PDF from the govt portal, or a photo/screenshot of one) and returns
// whatever fields it could confidently find, for the tracker form to pre-fill. The
// user still reviews and confirms every field before Save — this only saves typing.
export const parseDocument = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded.');

  const { text, source } = await ewaybillOcrService.extractText(req.file.buffer, req.file.mimetype);
  const fields = ewaybillOcrService.parseEwayBillFields(text);

  if (Object.keys(fields).length === 0) {
    throw ApiError.badRequest(
      "Couldn't read any e-way bill details from this file. Try the original PDF from the e-Way Bill portal, or a clearer photo, and enter the rest by hand."
    );
  }

  return new ApiResponse(200, { fields, source }, 'E-way bill document read.').send(res);
});
