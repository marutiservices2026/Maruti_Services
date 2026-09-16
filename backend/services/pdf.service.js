// pdf.service.js — Puppeteer HTML->PDF rendering for invoices (Section 16). Templates
// are read from disk once and cached in memory (Section 8: "cache PDF templates in
// memory; don't re-read the HTML template file per request").
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const DEFAULT_LOGO_PATH = path.join(ASSETS_DIR, 'logo-mark.png');

Handlebars.registerHelper('currency', (value) =>
  (Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
);
Handlebars.registerHelper('formatDate', (value) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
});
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('gt', (a, b) => Number(a) > Number(b));
Handlebars.registerHelper('inc', (i) => Number(i) + 1);
// DD-Mon-YYYY (e.g. "01-Aug-2026") — the reference invoice's date style, distinct from
// formatDate's "01 Aug 2026" used by the modern/detailed templates.
Handlebars.registerHelper('formatDateDash', (value) => {
  if (!value) return '';
  const d = new Date(value);
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleDateString('en-IN', { month: 'short' });
  return `${day}-${month}-${d.getFullYear()}`;
});
Handlebars.registerHelper('qty', (value) => (Number(value) || 0).toFixed(2));
// "(+)0.00" / "(-)0.00" — Round Off can go either way; the sign always shows explicitly.
Handlebars.registerHelper('signedAmount', (value) => {
  const n = Number(value) || 0;
  return `${n < 0 ? '(-)' : '(+)'}${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
});

const compiledTemplateCache = new Map();

async function getCompiledTemplate(documentType, templateKey) {
  const cacheKey = `${documentType}/${templateKey}`;
  if (compiledTemplateCache.has(cacheKey)) {
    return compiledTemplateCache.get(cacheKey);
  }

  const filePath = path.join(TEMPLATES_DIR, documentType, `${templateKey}.template.html`);
  let html;
  try {
    html = await fs.readFile(filePath, 'utf-8');
  } catch {
    throw ApiError.badRequest(`Unknown template "${templateKey}" for ${documentType}.`);
  }

  const compiled = Handlebars.compile(html);
  compiledTemplateCache.set(cacheKey, compiled);
  return compiled;
}

let defaultLogoDataUriPromise = null;

// The bundled brand mark (backend/assets/logo-mark.png), base64-embedded directly into the
// rendered HTML as a data: URI, used when a company hasn't uploaded its own logo — a
// company-uploaded logo/signature is now also stored as a data: URI (see
// company.controller.js), so neither path ever depends on network access during PDF
// generation. Read once and cached in memory, same pattern as the compiled-template cache
// above.
export function getDefaultLogoDataUri() {
  if (!defaultLogoDataUriPromise) {
    defaultLogoDataUriPromise = fs
      .readFile(DEFAULT_LOGO_PATH)
      .then((buf) => `data:image/png;base64,${buf.toString('base64')}`)
      .catch((err) => {
        defaultLogoDataUriPromise = null; // let the next call retry instead of caching a failure
        logger.error({ message: 'Failed to load default PDF logo asset', error: err.message });
        return '';
      });
  }
  return defaultLogoDataUriPromise;
}

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    browserPromise.catch(() => {
      browserPromise = null; // let the next call retry launching instead of caching a dead promise
    });
  }
  return browserPromise;
}

/**
 * Renders `data` into the given document type's template and returns a PDF Buffer.
 * @param {'invoice'} documentType
 * @param {'classic'|'modern'|'detailed'} templateKey
 * @param {object} data — the flat object the Handlebars template's {{fields}} read from.
 */
export async function renderPdf(documentType, templateKey, data) {
  // Template resolution errors (bad key) are a 400 client error — let them propagate as-is.
  const template = await getCompiledTemplate(documentType, templateKey);
  const html = template(data);

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      return await page.pdf({ format: 'A4', printBackground: true });
    } finally {
      await page.close();
    }
  } catch (err) {
    // Section 10: PDF generation failure — catch specifically, log which document/template
    // was involved, and surface a clear retry message rather than a generic 500.
    logger.error({ message: 'PDF generation failed', documentType, templateKey, error: err.message });
    throw ApiError.internal('PDF generation failed, please retry.');
  }
}

// For graceful shutdown / tests — closes the shared Puppeteer browser instance, if open.
export async function closePdfBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}
