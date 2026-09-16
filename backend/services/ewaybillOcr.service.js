// ewaybillOcr.service.js — reads an uploaded e-Way Bill document (the PDF/photo the
// client downloaded from the govt e-Way Bill portal after generating it) and extracts
// the fields the manual-entry tracker (Section 14) would otherwise need retyped by
// hand. A real EWB PDF carries a selectable text layer, so that is tried first — fast
// and exact, no OCR involved. Only a scanned/flattened PDF or a plain photo falls back
// to true OCR (tesseract.js) on a rasterized page.
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import { loadImage } from '@napi-rs/canvas';
import ApiError from '../utils/ApiError.js';

const MIN_USABLE_TEXT_LENGTH = 40;
const TESSERACT_CACHE_PATH = path.join(process.cwd(), '.tesseract-cache');

async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText({ first: 1 });
    return result.text || '';
  } finally {
    await parser.destroy();
  }
}

async function rasterizePdfFirstPage(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getScreenshot({
      first: 1,
      scale: 2,
      imageBuffer: true,
      imageDataUrl: false,
    });
    const page = result.pages?.[0];
    return page?.data ? Buffer.from(page.data) : null;
  } finally {
    await parser.destroy();
  }
}

// tesseract.js's underlying image decoder, when handed bytes it can't parse (a
// corrupted upload, a file mislabeled with an image mimetype it isn't — e.g. some
// phones report HEIC photos as image/jpeg), doesn't reject the recognize() promise —
// it emits an 'error' event on its internal Worker with no listener attached, which
// Node re-throws as an UNCAUGHT EXCEPTION that crashes the entire backend process, not
// just this request. Decoding the buffer with @napi-rs/canvas first (a real Promise,
// properly rejects on bad data) catches the common case with a clean 400 before
// tesseract ever sees the bytes.
async function assertDecodableImage(buffer) {
  try {
    await loadImage(buffer);
  } catch {
    throw ApiError.badRequest(
      "Couldn't read that image file — it may be corrupted or in an unsupported format. Try re-saving it as a JPEG or PNG."
    );
  }
}

// Defense in depth for the same crash, in case something slips past the canvas check
// above but still trips tesseract's decoder: process.once('uncaughtException', ...)
// intercepts the otherwise-fatal throw and turns it into a normal promise rejection,
// scoped to just this one recognize() call (removed immediately after, success or not).
function recognizeSafely(worker, buffer) {
  return new Promise((resolve, reject) => {
    const onUncaught = (err) => {
      process.removeListener('uncaughtException', onUncaught);
      reject(err);
    };
    process.once('uncaughtException', onUncaught);
    worker
      .recognize(buffer)
      .then((result) => {
        process.removeListener('uncaughtException', onUncaught);
        resolve(result);
      })
      .catch((err) => {
        process.removeListener('uncaughtException', onUncaught);
        reject(err);
      });
  });
}

async function ocrImage(buffer) {
  await assertDecodableImage(buffer);

  const worker = await createWorker('eng', 1, { cachePath: TESSERACT_CACHE_PATH });
  try {
    const {
      data: { text },
    } = await recognizeSafely(worker, buffer);
    return text || '';
  } catch {
    throw ApiError.badRequest(
      "Couldn't read that image file — it may be corrupted or in an unsupported format. Try re-saving it as a JPEG or PNG."
    );
  } finally {
    await worker.terminate();
  }
}

// Returns { text, source } — source is 'pdf-text' or 'ocr', useful for the caller to
// judge how much to trust the result before showing it to the user.
export async function extractText(buffer, mimetype) {
  if (mimetype === 'application/pdf') {
    const pdfText = await extractPdfText(buffer);
    if (pdfText.trim().length >= MIN_USABLE_TEXT_LENGTH) {
      return { text: pdfText, source: 'pdf-text' };
    }
    const raster = await rasterizePdfFirstPage(buffer);
    if (!raster) return { text: pdfText, source: 'pdf-text' };
    const ocrText = await ocrImage(raster);
    return { text: ocrText, source: 'ocr' };
  }
  const ocrText = await ocrImage(buffer);
  return { text: ocrText, source: 'ocr' };
}

function matchDate(text, labelPattern) {
  const re = new RegExp(`${labelPattern}[^\\d]{0,15}(\\d{1,2}[\\/\\-. ]\\d{1,2}[\\/\\-. ]\\d{2,4})`, 'i');
  const m = text.match(re);
  return m ? m[1] : null;
}

function toIsoDate(raw) {
  if (!raw) return null;
  const parts = raw.split(/[\/\-. ]/).filter(Boolean);
  if (parts.length !== 3) return null;
  let [d, mo, y] = parts;
  if (y.length === 2) y = `20${y}`;
  d = d.padStart(2, '0');
  mo = mo.padStart(2, '0');
  if (Number(d) > 31 || Number(mo) > 12) return null;
  return `${y}-${mo}-${d}`;
}

// Best-effort regex extraction against the standard EWB-01 layout's field labels.
// The caller always shows these in an editable form for the user to confirm — this
// only needs to save typing, not be perfectly accurate.
export function parseEwayBillFields(rawText) {
  const text = rawText.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, ' \n ').trim();
  const flat = text.replace(/\n/g, ' ');
  const found = {};

  const ewbMatch =
    flat.match(/e[-\s]?way\s*bill\s*no\.?\s*[:\-]?\s*(\d{9,12})/i) ||
    flat.match(/\bEWB\s*No\.?\s*[:\-]?\s*(\d{9,12})/i) ||
    flat.match(/\b(\d{12})\b/);
  if (ewbMatch) found.ewbNo = ewbMatch[1];

  const genDateIso = toIsoDate(
    matchDate(flat, '(?:e[-\\s]?way\\s*bill\\s*date|generated\\s*date|date\\s*of\\s*generation|generated\\s*at)')
  );
  if (genDateIso) found.generatedDate = genDateIso;

  const validIso = toIsoDate(matchDate(flat, '(?:valid\\s*(?:up\\s*to|until|till))'));
  if (validIso) found.validUpto = validIso;

  // OCR commonly confuses O/0 and I,L/1 in the plate's numeric segments (state-code
  // suffix and serial number) — captured separately from the letter segments so the
  // fix-up only ever touches digits, never the state/series letters.
  const vehicleMatch = flat.match(
    /vehicle\s*no\.?\s*[:\-]?\s*([A-Z]{2})\s?-?\s?([0-9OIL]{1,2})\s?-?\s?([A-Z]{1,3})\s?-?\s?([0-9OIL]{1,4})\b/i
  );
  if (vehicleMatch) {
    const [, state, rto, series, serial] = vehicleMatch;
    const fixDigits = (s) => s.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
    found.vehicleNo = `${state.toUpperCase()}${fixDigits(rto)}${series.toUpperCase()}${fixDigits(serial)}`;
  }

  const transporterMatch = flat.match(
    /transporter\s*name\s*[:\-]?\s*([A-Za-z0-9&.,'\- ]{3,60}?)(?=\s{2,}|\s*Transporter\s*ID|\s*Approx|\s*Distance|$)/i
  );
  if (transporterMatch) found.transporterName = transporterMatch[1].trim();

  const distanceMatch =
    flat.match(/(?:approx\.?\s*distance|distance)\s*\(?\s*(?:in\s*)?km\)?\s*[:\-]?\s*(\d+(?:\.\d+)?)/i) ||
    flat.match(/(?:approx\.?\s*distance|distance)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*k\.?m\.?/i);
  if (distanceMatch) found.distance = Number(distanceMatch[1]);

  return found;
}
