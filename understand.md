# understand.md — Project Knowledge Base

> **Purpose:** This file is the single source of truth for any AI model (or human) picking up
> this project cold. It should be enough, on its own, to understand what this project is,
> how it's built, why key decisions were made, and where everything lives — without needing
> to re-read the entire codebase or prior conversation history.
>
> **Maintenance rule (read this first): this file MUST be kept in sync with the project.**
> Whenever a change is made to the codebase — a new feature, a new file, a schema change, a
> new convention, a bug fix that reveals a non-obvious gotcha, a new dependency, a deployment
> change — update the relevant section of this file **in the same turn** as the code change,
> not later. Treat an out-of-date `understand.md` as a bug. See "How to keep this file
> updated" at the bottom for the exact protocol.

Last updated: 2026-09-16 (found a real production bug live — "Download PDF" 500s on every
invoice, because Puppeteer's bundled Chromium can't launch on Render's default Node
runtime; fixed by switching `render.yaml` to `runtime: docker`, which the prepared
`Dockerfile` already supports — still needs a commit+push and possibly a manual Render
dashboard step to actually take effect on the live service; see §9. Also: Supplier's Ref. on the classic invoice template now
auto-defaults to the invoice's own sequence number, no leading zeros — `GST-0001` -> `"1"`
— unless the user types their own value; see §5. Also: frontend now also deployed and live, at
`https://marutiservices-rho.vercel.app`; fixed a real CORS bug in `backend/.env.production`'s
`CLIENT_URL` — had a `/login` path on it, which the exact-match `cors({origin: ...})` check
in `index.js` would never match since the browser's Origin header never includes a path;
still needs the same fix applied by hand in Render's dashboard, since `CLIENT_URL` is
`sync: false` there. Also: backend is now actually deployed and live at
`https://maruti-services.onrender.com`, confirmed via a real `curl /health` → `200 {"status":
"ok"}`; fixed a real bug in the user's `frontend/.env.production` — missing the `/api/v1`
suffix every other environment includes, which would have 404'd every API call in
production — and flagged that the keep-alive workflow's `RENDER_APP_URL` repo variable and
the backend's `CLIENT_URL` (CORS) still need manual setup; see §9. Also: added
`backend/.env.production` — a real, ready-to-paste
production environment file, gitignored explicitly since `.gitignore`'s bare `.env`
pattern doesn't cover it; see §9. Also: added Render free-tier keep-alive prep: a new `GET /health`
route — the one deliberate exception to the POST-only convention — plus a GitHub Actions
workflow that pings it every 14 minutes once `RENDER_APP_URL` is set post-deploy; see §2 and
§9. Also: migrated the real Company record — only the company, no parties/
products/invoices — from local to Atlas, and created a real production login directly in
the database since the app has no "add a user to an existing company" flow; verified live
via a temporary second backend instance, not just a raw DB read. See §9. Also: found and
fixed a genuine duplicate API call on Dashboard mount —
`gst-summary` was fetched twice with identical params; StrictMode's expected dev-only
double-invoke was masking/amplifying it, which is what made it visible in DevTools — see §6.
Also: fixed a Company-not-found/infinite-loading bug caused by editing
`.env` without restarting the backend — the running server kept using its old in-memory
Atlas connection after `.env` was switched back to local; general gotcha, not just a
MongoDB one — see §9. Also: pushed this repo to GitHub (`marutiservices2026/Maruti_Services`).
On top of the same day's earlier: this project became a git repository — `git init` + root commit
`cedfbc5` on `master`, 135 files, committed locally but not yet pushed anywhere; a few stray
dev artifacts predating git were cleaned up first. See §9. On top of the same day's earlier:
`MONGO_URI` switched from local standalone MongoDB to a real
Atlas cluster at the user's request — database now `gst_billing` and currently empty, no
demo login works on it; also documented a sandbox-specific gotcha where Node's raw DNS
resolver is blocked, breaking `mongodb+srv://` — see §9.)

Last updated: 2026-09-15 (added a custom `Select` component replacing the native dropdown
on two filter selects, and fixed a native-button-border bug on the DatePicker's Clear/Today
buttons — see §6. Also: redesigned every button in the app — hover/active/focus states
none of them had before, plus a new Ledger Green `success` variant used on "Finalize" — see
§6. Also: added a custom `DatePicker` component for the Dashboard's Sales
Report From/To fields, replacing the native `<input type="date">` popup that couldn't be
restyled to match the app's design system — see §6. Also: logo/signature upload removed
entirely, not just Cloudinary as
its storage backend — the bundled default logo already IS this company's own logo, and
signature had no fallback but was removed anyway at the user's request; see §6. Also fixed
a regression from the same day's custom-fields removal —
the Settings sidebar link still pointed at the deleted `/settings/fields` route, silently
bouncing to Dashboard via the catch-all redirect with no visible error; see §6. Also: field-
level validation errors now actually reach the user instead of a bare "Validation failed." —
see §6's dated note — following a 119-request API negative-test sweep confirming zero 500s
elsewhere, see §10. Same day, also: backend `app.js` merged
into `index.js` (§3); the custom-fields system/FieldConfig and Cloudinary both removed
entirely after a real-usage audit found neither had ever been used (§6); and an earlier
UI/UX audit's fixes — invoice search, a confirm-modal label mismatch, inline "+ New Party"
creation and the modal-stacking bug it exposed, keyboard-hint consistency, field-key
auto-slugify, and the `window.confirm` → modal replacement (§6))

---

## 1. What this project is

A **GST Sales Billing web application** for an Indian manufacturing business ("Maruti
Packaging" is the demo company). It replaces manual/Excel-based GST invoicing with a proper
web app: create sales invoices, auto-calculate CGST/SGST/IGST, generate print-ready PDF
invoices in a specific letterhead format, track e-way bills, manage parties/products, and
produce GST reports (sales register, GST summary).

> **This was originally a "Purchase & Sales" app — Purchases was fully, deliberately removed
> on 2026-09-14** at the user's explicit request ("we don't need purchase and all we need
> only sales"), after confirming with them that this meant a hard delete (not just hiding the
> nav item) and accepting the consequence that "GST Payable" is now simply total output tax
> on sales, not a true net-of-input-tax-credit figure (there's no purchase data to net
> against anymore — see the Reports note at the end of §8). Every `PurchaseBill`/`purchase*` model,
> controller, route, page, component, and template was deleted outright, not archived. If you
> encounter a stray reference to "purchase" anywhere in the code that this file doesn't
> mention, that's drift — clean it up and update this file, don't assume it's intentional.

It was built from a detailed technical specification PDF (`GST-Billing-Software-Spec.pdf` at
the project root) following an 18-step build order. The spec's section numbers (e.g.
"Section 6a", "Section 15") are referenced throughout the codebase's own comments — when you
see `// Section N` in a comment, it's citing that spec document, not this file.

**Stack:** MERN — MongoDB, Express, React (Vite), Node.js. Two independent repos/folders:
`backend/` and `frontend/`. No monorepo tooling; each has its own `package.json` and runs
independently.

---

## 2. Non-negotiable project-wide conventions

These are load-bearing decisions made early and applied consistently everywhere. Breaking
one of these in a new feature is very likely a mistake, not a legitimate exception.

1. **Every backend route is POST — no GET/PUT/PATCH/DELETE, with exactly one exception:
   `GET /health` (added 2026-09-16, registered directly in `index.js`, not `router.js` —
   see its own comment there for why, and §9 for the keep-alive pinger it exists for).**
   Every other route, including this one's neighbors, stays POST — filters, IDs, and
   pagination that would normally be query params or path params travel in the JSON request
   body instead. See `backend/router.js` line 1's comment. This applies even to "detail" and
   "list" endpoints (`/invoices/detail`, `/parties/list`, etc.) and to "delete" endpoints
   (`/parties/delete` is a POST with an `id` in the body, not a DELETE verb).
2. **ES Modules throughout the backend** — `import`/`export`, never `require`/`module.exports`.
   `"type": "module"` in `backend/package.json`.
3. **Controllers never touch Mongoose models directly.** All DB access goes through
   `backend/methods.js` (a centralized thin wrapper: `create`, `findAll`, `findById`,
   `findOne`, `updateById`, `deleteById`, `paginate`, `aggregate`, `withTransaction`).
   **Exception:** `services/` files (gst.service, invoiceNumber.service, ewaybillOcr.service,
   etc. — NOT `dynamicField.service.js`, removed 2026-09-15 along with the custom-fields
   system, see §6) are allowed to touch models/mongoose directly, since they
   encapsulate business logic that legitimately needs finer control.
4. **`router.js` is the single routes file.** Every route in the whole backend is declared
   there — there is no per-feature router file. Each line: path, `authMiddleware` (unless
   public), `requireRole('admin')` where needed, `validate(zodSchema)`, then the controller
   function.
5. **Zod validation on (almost) every route**, via `middlewares/validate.middleware.js` and a
   schema exported alongside each controller function (e.g. `createInvoiceSchema`). Frontend
   mirrors this with `react-hook-form` + `@hookform/resolvers/zod` in form components.
6. **JWT auth, two tokens:**
   - Access token: short-lived, returned in the login/refresh response body (not a cookie),
     stored client-side in a Zustand store with `persist` middleware (`localStorage`).
   - Refresh token: longer-lived, `httpOnly` cookie. `sameSite: 'none', secure: true` in
     production; `sameSite: 'lax', secure: false` in dev (cookies over plain `http://localhost`
     can't be `secure`).
   - `auth.middleware.js` reads `Authorization: Bearer <token>` and attaches
     `req.user = { id, company, role }`.
7. **MongoDB transactions** via `methods.withTransaction()` — used specifically for
   Counter-increment + Invoice-create atomicity (so two concurrent creates never get the
   same invoice number). **This only works on a MongoDB replica set.** MongoDB Atlas
   is always a replica set (works in production). A local standalone `mongod` is NOT a
   replica set — transactions will throw `"Transaction numbers are only allowed on a replica
   set member or mongos"` locally. This is expected and NOT a bug; do not "fix" it by ripping
   out the transaction. (During local dev/testing only, this has been temporarily bypassed by
   short-circuiting `withTransaction` — always revert that before finishing.)
8. **Winston structured logging** with PII/secret redaction (`backend/utils/logger.js`) —
   recursively redacts `password`, `token`, `gstin`, `pan`, `bankDetails` fields.
   **Gotcha:** a custom Winston format function must **mutate** the `info` object in place
   (`Object.assign(info, redact(info)); return info;`), never return a brand-new plain object
   — Winston/triple-beam attach internal Symbol-keyed properties to `info` that a replacement
   object silently loses, which makes logs vanish with no error.
9. **PDF generation:** Puppeteer renders Handlebars-templated HTML to PDF, server-side.
   Templates are cached in memory after first read (`pdf.service.js`).
10. **GST calculation** (`gst.service.js`): compares seller state code vs buyer state code —
    equal → CGST+SGST split (half the rate each); different → IGST (full rate). Round-off =
    `Math.round(total) - total`, stored and shown explicitly on the invoice.
11. **Indian numbering (Lakh/Crore) for amount-in-words**, deliberately duplicated in both
    `backend/services/numberToWords.service.js` (authoritative, used at save/PDF time) and
    `frontend/src/utils/numberToWords.js` (for instant UI feedback while typing, before save).
    If you change the algorithm, change both.
12. ~~Dynamic/Tally-style custom fields (`FieldConfig`).~~ **Removed 2026-09-15** — see §6's
    "Custom-fields system (FieldConfig) and Cloudinary both removed" note. A real-usage audit
    found zero `FieldConfig` documents had ever existed across the app's actual data (every
    real invoice's `customFields` was `{}`), so the whole per-company/per-entity dynamic-field
    engine was cut rather than kept "in case it's needed later." If you're asked to add a
    field the business actually needs, add it as a real schema field on the relevant model —
    don't reintroduce the generic engine.
13. **Masters** (`Master` model) replace hardcoded enums — units, tax rates, voucher types,
    payment terms, states — scoped per company, editable from **Settings → Manage Masters**.
14. **Three PDF templates** (`classic` / `modern` / `detailed`) for invoices, selectable
    per-company (`Company.invoiceTemplate`) with an optional per-document override
    (`Invoice.templateOverride`).
15. **The `classic` invoice PDF template is pinned to a specific reference layout** the
    user supplied (a real-world Indian tax-invoice image) — see
    `backend/templates/invoice/classic.template.html`. Do not restyle it without being
    asked; it was deliberately built field-for-field to match that
    reference (top band, boxed From/To header, CGST/SGST/Round-Off as italic embedded rows,
    "Amount Chargeable (in words)" + "E & O E", HSN breakup table with "Central Tax"/"State
    Tax" headers, PAN+Declaration/Bank+signature footer, dark contact band). It intentionally
    uses plain Arial/Helvetica fonts (matches the reference), **not** the app's own branded
    UI fonts — this is correct and should not be "fixed".
16. **Keyboard-first "Tally-style" UX** is a first-class design goal, not an afterthought —
    see section 6 below for the full shortcut map. The user explicitly wants minimal mouse
    use, vendor-staff-friendly like Tally ERP.

---

## 3. Backend structure (`backend/`)

```
backend/
├── index.js                  — entry point: validates env, builds the express app (middleware wiring —
│                                helmet, cors, json, cookies — mounts router), connects DB, starts HTTP
│                                server. Used to be split into app.js (build) + index.js (run) — merged
│                                2026-09-15 at the user's request; see the dated note further down for
│                                why the split existed and what you'd need if an automated test suite is
│                                ever added (the usual reason for that split).
├── router.js                 — SINGLE routes file, every route in the whole app
├── methods.js                — centralized DB access layer (see convention #3 above)
├── config/
│   ├── env.js                 — loads + validates required env vars (MONGO_URI, JWT_SECRET); fails fast if missing
│   ├── db.js                  — mongoose.connect()
├── models/                    — one file per Mongoose model (see section 4)
├── controllers/                — one file per resource, exports zod schemas + async handlers
├── validators/                 — zod schemas for party/product/invoice (some schemas live inline in the controller instead — no strict rule on which)
├── services/                   — business logic that's allowed to touch models directly (see section 5)
├── middlewares/
│   ├── auth.middleware.js       — verifies JWT, sets req.user
│   ├── role.middleware.js       — requireRole('admin') gate
│   ├── validate.middleware.js    — wraps a zod schema, validates req.body
│   ├── rateLimiter.middleware.js — login rate limiting
│   └── error.middleware.js       — central error handler (ApiError -> JSON response), mounted last in index.js
├── utils/
│   ├── ApiError.js / ApiResponse.js — consistent success/error response shape
│   ├── asyncHandler.js           — wraps async controller fns so thrown errors reach error.middleware
│   └── logger.js                 — Winston + redaction (see convention #8)
└── templates/                  — Handlebars HTML templates for PDF generation (invoice/, with classic/modern/detailed)
```

### Environment variables (`backend/.env` — not committed; see `.env.example`)

```
PORT=5099
MONGO_URI=mongodb://localhost:27017/gst_billing_demo   (local dev — see section 9)
JWT_SECRET=<random>
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
EWAYBILL_THRESHOLD=50000
LOG_LEVEL=info
```
`config/env.js` throws at startup if `MONGO_URI` or `JWT_SECRET` is missing — this is
intentional fail-fast behavior, not a bug to work around.

### `app.js` merged into `index.js` (2026-09-15)
This project used to split the Express setup across two files — `app.js` built the
`express()` instance and wired every middleware/route/error-handler onto it, exported as
`app`; `index.js` imported that, then called `validateEnv()`, `connectDB()`, and
`app.listen()`. That split is a standard Node/Express convention, and it exists for one
specific reason: it lets a test file `import app from './app.js'` and drive real requests at
it with `supertest`, without ever opening a real database connection or binding a real port
— useful for fast, isolated route/controller tests. This project has no automated test
suite (see §10 — verification is live, via the browser-automation skill against the running
dev servers), so that benefit was never actually being used, and the user asked for the two
files to be merged back into one. `index.js` now does both: builds the app inline, then
connects the DB and starts listening, in the same file, in that order. Nothing about
runtime behavior changed — same middleware, same order, same routes, same error handling —
verified live (login, an invoice list fetch, and a request to an unknown route all still
behave identically, the last one still producing the same `ApiError`-shaped 404 JSON body).
**If an automated test suite is ever added, this is the first thing to reconsider** — pull
the app-building code (everything before `connectDB()`) back out into its own module that
exports `app` without any side effects, so tests can import it directly.

---

## 4. Data model (MongoDB / Mongoose, all in `backend/models/`)

All documents scoped to a `company` field (multi-tenant-ready even though v1 is single-company
per login). All schemas use `{ timestamps: true, strict: true }`.

- **User** — `name, email (unique), passwordHash (select:false), role (admin|accountant), company`
- **Company** — the seller's own profile: `name, tagline, address, gstin, stateName,
  stateCode, pan, phone, email, website, bankDetails {bankName, accountNo, branch, ifsc},
  invoiceTemplate`. (Had `logoUrl`/`signatureUrl` fields until 2026-09-15 — removed along
  with logo/signature upload entirely, see §6.)
- **Party** — buyers/suppliers: `company, name, address, gstin, stateName, stateCode, type
  (buyer|supplier|both), contactInfo {phone, email}, isActive`. (Had a `customFields` field
  until 2026-09-15 — removed with the rest of the FieldConfig system, see convention #12.)
- **Product** — `company, name, hsnSac, unit (ref Master), defaultRate, gstRate (ref Master),
  category, isActive`. (Also had `customFields` until 2026-09-15.)
- **Invoice** (sales, outgoing) — see full field list in `Invoice.model.js`; key parts:
  `company (seller), buyer (ref Party), invoiceNo, financialYear, invoiceDate, documentTitle,
  copyType, items[] (each: product ref, description, hsnSac, quantity, unit, rate, amount),
  taxableValue, cgstRate/Amount, sgstRate/Amount, igstRate/Amount, roundOff,
  totalQuantity, totalAmount, hsnWiseBreakup[] (per-HSN tax breakdown, computed by
  gst.service.js, needed because line items don't store their own gstRate), amountInWords,
  taxAmountInWords, ewayBillRequired, ewayBillNo, status (draft|finalized|cancelled),
  createdBy, templateOverride`. (Both the invoice document and each item in `items[]` also
  had a `customFields` field until 2026-09-15.)
  **Unique index:** `{company, financialYear, invoiceNo}` — NOT just `{company, invoiceNo}`,
  because the printed number (e.g. `GST-0001`) resets every financial year and doesn't encode
  the year itself; without `financialYear` in the index, two different years would collide.
- ~~**PurchaseBill**~~ — **removed 2026-09-14** (see §1). Used to mirror Invoice with a
  `supplier` (ref Party) instead of `buyer`, `purchaseNo`/`supplierInvoiceNo`/
  `supplierInvoiceDate`, and an `attachmentUrl` for a scanned physical bill. If you need to
  understand its old shape (e.g. reading historical context), it's gone from the code —
  nothing to look at except this note.
- **EwayBill** — manual e-way bill tracker record, one per sales invoice:
  `company, invoice (ref, required), ewbNo, generatedDate, validUpto, vehicleNo,
  transporterName, distance`. **Not a direct GSTN e-Way Bill API integration** (that needs a
  GSP account, out of scope for v1) — this just tracks the number the user generated
  themselves on the govt portal, optionally auto-filled via OCR (see section 7). Before
  2026-09-14 this also had a nullable `purchaseBill` ref with an either/or validation hook —
  removed along with Purchases; `invoice` is now simply required.
- ~~**FieldConfig**~~ — **removed 2026-09-15** (see convention #12) — used to hold dynamic
  custom-field definitions, unique-indexed on `{company, entity, fieldKey}`. Deleted outright
  (no data migration needed — every real `customFields` value in the database was already
  `{}`, and zero `FieldConfig` documents had ever been created).
- **Master** — generic Tally-style master data (see convention #13).
  Unique index: `{company, type, code}`.
- **Counter** — atomic per-company, per-financial-year sequence for invoice numbering
  (`key` e.g. `INV-2026-27`), incremented inside a `withTransaction` alongside the invoice
  create, with a client-editable `prefix` (default `"GST"`).

---

## 5. Backend services (`backend/services/`) — the "allowed to touch models directly" layer

- **gst.service.js** — CGST/SGST vs IGST split logic, HSN-wise breakup computation, round-off.
- **invoiceNumber.service.js** — `getNextDocumentNumber(companyId, 'invoice', date,
  session)` generates the next invoice number via `Counter`, scoped per
  `company + financial year` (key e.g. `INV-2026-27`); pass the transaction `session` when
  called alongside the Invoice create. Default prefix is `"GST"` (editable per-Counter after
  creation). `getFinancialYear(date)` computes the Indian FY string (Apr 1 – Mar 31, e.g.
  `"2026-27"` for any date in that window). The `series` param is a vestige of when a
  `'purchase'`/`PUR-` series also existed (removed 2026-09-14, see §1) — only `'invoice'` is
  valid now. Retries the upsert once on a MongoDB duplicate-key
  error (code `11000`) — two concurrent requests can both attempt to insert the same
  brand-new Counter document for a company's first invoice of a new FY; the retry lets the
  second one fall through to a normal `$inc` update instead of crashing.
  - **`supplierRef` auto-default, added 2026-09-16** (`invoice.controller.js`'s `create`):
    defaults the classic template's "Supplier's Ref." field (same table column as "Invoice
    No.", one row down — `templates/invoice/classic.template.html:124`) to the invoice's own
    sequence number with no leading zeros, e.g. `GST-0001` → `"1"`, `GST-0025` → `"25"` —
    the user's explicit choice among three options (the alternatives were the last-2-digits
    reading of `"01"` and the full zero-padded `"0001"`). Implementation: `getNextDocument
    Number` already returned `seq` (the raw counter integer) alongside the zero-padded
    `documentNo` string, so this is just `supplierRef: req.body.supplierRef || String(seq)`
    — only a default, an explicitly typed Supplier's Ref (the "More Fields" input in
    `InvoiceForm.jsx`) still wins, since real invoices sometimes do need a genuinely
    different reference there. **Verified the string-derivation logic in isolation**
    (`String(1) -> "1"`, `String(25) -> "25"`, etc. — matches the agreed rule exactly); did
    **not** verify end-to-end through a real invoice creation, since that requires either a
    local login this session doesn't have credentials for, or calling the counter service
    directly against the real local data (`gst_billing_demo`, real invoices already in the
    teens) — which would burn a real sequence number and leave a permanent gap. Next
    session/user should confirm this once by creating one real invoice and checking the
    printed PDF's Supplier's Ref. against its Invoice No.
- **numberToWords.service.js** — Indian Lakh/Crore amount-in-words (see convention #11).
- ~~**dynamicField.service.js**~~ — **removed 2026-09-15** — used to validate/merge
  `customFields` against a company's active `FieldConfig` entries; deleted along with the
  rest of the custom-fields system.
- **ewaybillThreshold.service.js** — sets `ewayBillRequired` on an Invoice based on
  `EWAYBILL_THRESHOLD` env var (default ₹50,000) vs the document's total value.
- **pdf.service.js** — loads/caches Handlebars templates, registers custom Handlebars helpers
  (`formatDateDash`, `qty`, `signedAmount`, `currency`, etc.), renders HTML, runs Puppeteer to
  produce the PDF buffer.
- **ewaybillOcr.service.js** — reads an uploaded e-way bill document and extracts fields (see
  section 7 for full detail — this is the most recently added service).

---

## 6. Frontend structure (`frontend/src/`)

```
src/
├── main.jsx / App.jsx        — entry, root providers
├── routes/
│   ├── AppRoutes.jsx           — all routes, lazy-loaded, wrapped in ProtectedRoute + DashboardLayout
│   └── ProtectedRoute.jsx
├── store/                     — Zustand: authSlice (JWT + persist), invoiceSlice (party/product cache for the invoice form)
├── api/                       — one file per resource, thin axios wrappers, always POST (axiosClient.js has the base axios instance + interceptors)
├── context/AuthContext.jsx
├── hooks/                      — useAuth, useDebounce, useInvoiceCalculations, useSpaceShortcut
├── components/
│   ├── common/                 — Button, Input, Modal, ConfirmDialog, Table, Loader, Toast, KeyboardHintBar
│   ├── layout/                 — DashboardLayout (shell + global keyboard handling), Sidebar (nav + Alt+N shortcuts), Navbar
│   ├── invoice/                 — Form, LineItems (voucher-style grid), Preview, TaxSummaryTable
│   (components/dynamic/ — DynamicFieldRenderer, FieldConfigForm — existed here until
│   2026-09-15, removed with the rest of the custom-fields system)
│   └── settings/                — SettingsNav, TemplateGallery, TemplatePreviewCard
├── pages/                      — one folder per route group: auth, dashboard, invoices, parties, products, ewaybill, settings (no reports/ — folded into dashboard/, see §8)
├── utils/                       — formatters, gstCalculator (mirrors backend for live UI feedback), numberToWords (see convention #11), domFocus (isInteractive helper)
└── index.css                   — the entire design system: CSS custom properties, no component-scoped CSS files
```

### Design system (`index.css`)
- Fonts: `--font-heading: 'Space Grotesk'`, `--font-body: 'IBM Plex Sans'`,
  `--font-mono: 'IBM Plex Mono'` (numbers/ledgers — tabular-nums). Loaded via Google Fonts
  `<link>` in `frontend/index.html`.
- Color tokens: `--color-ink-navy` (primary dark), `--color-paper-white` (background),
  `--color-rule-grey`, `--color-stamp-red` (danger/accent), `--color-ledger-green`,
  `--color-slate-text`.
- No CSS-in-JS, no Tailwind, no component-scoped stylesheets — one global `index.css` with
  class-based conventions (`.btn`, `.input`, `.field`, `.page`, `.table-wrap`, `.ledger`,
  `.row`, `.form-grid`, etc.). Native controls (`select`, `input[type=file]`,
  `input[type=date]`) are explicitly restyled to match rather than left as OS defaults.

### Gotcha: `overflow-x: auto` alone can silently add a vertical scrollbar too (fixed 2026-09-14)
`.settings-nav` had `overflow-x: auto` with no `overflow-y` specified — the CSS spec
requires that when one axis is non-`visible`, the other is *also* forced to `auto` if left
unset, so the moment its content was even 1px taller than the container, a vertical
scrollbar appeared too (showing as small up/down arrow buttons in Windows' classic
non-overlay scrollbar rendering — easy to mistake for a rendering bug rather than a real,
if pointless, scrollbar). Fixed by adding `overflow-y: hidden` explicitly. **Any element
that sets only `overflow-x` (or only `overflow-y`) without deciding the other axis
explicitly is at risk of this same thing** — check for it if a similarly out-of-place
scrollbar/arrow shows up somewhere else.

### Voucher-entry number inputs: widened, and scroll-to-increment already works natively (2026-09-14)
`InvoiceLineItems.jsx`'s Qty/Rate `<input type="number">` cells were narrow enough that a
typed value like `1234.45` could look cramped/clipped — `.voucher-table`'s Qty/Rate column
widths were bumped up (8%→11%, 10%→12%) and a `min-width: 78px` floor was added on
`.voucher-table input[type='number'].input` so the value stays fully visible regardless of
how the table's own layout resolves. Separately, the user asked for scroll-wheel
increment/decrement on these fields — **verified this already works with zero code
changes needed**: `type="number"` inputs support scroll-to-adjust natively in Chromium,
but only once the field has focus (click into it first) — hovering without focusing does
not trigger it, which is correct/intentional browser behavior (it stops a value from
silently changing just because the cursor happened to pass over the field while the page
was being scrolled). Don't add a custom `onWheel` handler for this — it would have to
`preventDefault()` unconditionally to override the page's own scroll, which reintroduces
exactly the accidental-data-change risk the native focus-gated behavior avoids.

### Gotcha: selecting GST% used to silently append a whole new line item (fixed 2026-09-15)
`InvoiceLineItems.jsx`'s `advance()` moves focus to the next field on a row, spilling to the
next row, or — at the very end of the last row — appending a brand-new empty row so
keyboard-only entry never has to stop to click "+ Add Line." That's deliberate Tally-style
UX for a genuine Enter keypress. But the GST% `<select>` also calls `advance()` from its
`onChange` (selects advance on `onChange`, not `Enter` — see the file's own top comment),
and `onChange` fires identically whether the value was picked with a mouse or a keyboard,
with no way to tell which from the event alone. Since GST% is the last field in
`FIELD_ORDER`, picking a value on the last row — including a plain mouse click, not just a
keyboard confirm — silently created and focused a whole new line item as a side effect.
Reported as "feels like a glitch," and it was a real UX bug, not just a keyboard user's
expectation: creating new app state from what looks like "just picking a dropdown value"
is a bigger, more surprising side effect than losing a keystroke of convenience.
**Fix:** `advance()` now takes an `{ allowNewRow = true }` option; `handleGstRateSelect`
passes `allowNewRow: false`, so selecting GST% still moves focus into an *existing* next
row (harmless — no new state) but no longer fabricates a new one. The genuine
Enter-keypress path (`handleRowKeyDown`, e.g. pressing Enter on Rate when GST renders
read-only because a product is linked) is untouched and still auto-adds a row — verified
live: selecting GST% via `selectOption` on the last row leaves the row count unchanged,
while pressing Enter on the last field of the last row still creates and focuses row 2 as
before. If another `<select>` in this grid is ever made the terminal field in
`FIELD_ORDER`, give its select-handler the same `{ allowNewRow: false }` treatment.

### PDF invoice logo — bundled, not upload-dependent (added 2026-09-14)
The user didn't want to use the Cloudinary logo-upload flow at all (it wasn't configured
locally either, at the time). Cloudinary has since been removed entirely (2026-09-15) — see
the dated note further down — but this bundled-default mechanism predates and is independent
of that removal, and still exists exactly as described below. Instead, the PDF's logo falls
back to a bundled asset:
- `backend/assets/logo-mark.png` — the cropped square icon mark (same crop as the frontend
  favicon, NOT the full "MARUTI PACKAGING" wordmark lockup — deliberately, since the PDF
  header also prints `{{companyName}}` as text right next to the logo image; using the full
  wordmark image would visually duplicate/risk mismatching the company's actual stored
  `name` field).
- `pdf.service.js#getDefaultLogoDataUri()` reads this file once, caches it in memory (same
  pattern as the compiled-template cache), and returns it as a `data:image/png;base64,...`
  URI — embedded directly into the rendered HTML, not referenced by a `src="https://..."`
  URL. This means PDF generation has zero dependency on network access, Cloudinary, or the
  frontend's `public/` folder being present.
- `invoice.controller.js#downloadPdf` originally built `logoUrl: company.logoUrl ||
  defaultLogoDataUri` — a company-uploaded logo took priority, the bundled mark was only the
  fallback. Logo/signature upload was removed entirely 2026-09-15 (see the dated note
  further down — the bundled mark already *is* this company's own logo, so uploading a
  different one was never actually a real need), so this now just always sets
  `logoUrl: defaultLogoDataUri` unconditionally — no more `||`, since `company.logoUrl` can
  never exist anymore.
  (The old `company.logoUrl ||` fallback originally also existed in
  `purchase.controller.js#downloadPdf`, removed with the rest of Purchases on 2026-09-14 —
  see §1.)
- `detailed.template.html` has no logo slot at all (pre-existing, not added here — out of
  scope unless asked). `classic` and `modern` both do.
- If the source logo (`frontend/public/logo.png`) is ever replaced, re-derive
  `backend/assets/logo-mark.png` the same way the favicon crop was made (see the branding
  assets entry just below) rather than hand-editing it — keep the backend and frontend icon
  crops in sync.

### Branding assets (added 2026-09-14)
- The real "Maruti Packaging" logo lives at `frontend/public/logo.png` (1951×806, transparent
  background, navy "MARUTI" wordmark + orange "PACKAGING"/swoosh, with a square "MP" icon
  mark at the top). The user supplies this file directly into `public/` — it is not generated.
- Favicons/touch-icon (`favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png`,
  `apple-touch-icon.png`, `icon-512.png`, all in `frontend/public/`) are **cropped from just
  the square icon mark**, not the full wide logo — a favicon slot is too small/square for the
  full lockup to read. They were generated once via a throwaway Node script using
  `@napi-rs/canvas` (already present as a transitive dep of the backend's `pdf-parse`): scan
  for the first contiguous non-transparent row-band from the top (the icon sits above the
  wordmark, separated by a transparent gap) to isolate the icon's bounding box, pad it onto a
  square canvas, downscale to each target size. If the source `logo.png` is ever replaced,
  re-run an equivalent crop rather than hand-editing the icon PNGs. Wired into
  `frontend/index.html` via `<link rel="icon">`/`<link rel="apple-touch-icon">` tags; page
  `<title>` is `"Maruti Packaging Billing Software"`.
- **Contrast gotcha:** the logo's navy elements (wordmark text, icon brackets/M) are drawn on
  a *transparent* background, so they disappear when placed directly on the app's own navy
  (`--color-ink-navy`) surfaces — e.g. the sidebar. `Sidebar.jsx`'s `.brand` therefore wraps
  the icon in a small white rounded chip (`.brand-mark` in `index.css`) so it stays legible,
  next to plain white "Maruti Packaging" text (not an image — the full wordmark image is only
  used where the background is light). `Login.jsx` uses the full-color `logo.png` image
  directly, since its card background is `--color-paper-white` (light, no contrast issue).
- Responsive breakpoint: `@media (max-width: 800px)` — sidebar becomes a horizontal
  scrolling strip, `.row`/`.form-grid` collapse/wrap, keyboard-hint UI is hidden (irrelevant
  on touch).

### Keyboard-first UX system (this is a deliberate, heavily-tested feature area)

- **`Alt+1` … `Alt+6`** — jump to sidebar section N (Dashboard/Invoices/Parties/Products/
  E-Way Bills/Settings — was Alt+1..8 with a Purchases entry before 2026-09-14 (see §1), then
  Alt+1..7 with a separate Reports entry until later that same day, when Reports was folded
  directly into Dashboard.jsx and its nav item removed (see §8's Reports note — one less
  click was the whole point). The numbering auto-shifts on either kind of change since it's
  derived from `SIDEBAR_LINKS` array index, not hardcoded. **Never `Ctrl+1-9`** — that's
  irreversibly browser-reserved for tab-switching
  and cannot be intercepted by a web page.
- **`Space`** (via `useSpaceShortcut` hook, guarded by `isInteractive(document.activeElement)`
  from `utils/domFocus.js` — excludes INPUT/TEXTAREA/SELECT/BUTTON/A/contentEditable) — opens
  the "New X" modal on list pages (Invoices/Parties/Products). Disabled while a modal is
  already open.
- **`Backspace`** (same `isInteractive` guard, plus a check that no `.modal-overlay` is open)
  — global "back" (`navigate(-1)`), wired in `DashboardLayout.jsx`. A hint (`Backspace Back`)
  is always visible in the top navbar.
- **`Escape`** — closes modals / cancels in-progress forms.
- **`Ctrl+Enter`** — saves the currently open form (deliberately not Tally's literal `Ctrl+A`,
  which would break normal text-selection).
- **`Alt+D` / `Alt+I`** — delete / insert a voucher line-item row (matches real Tally
  conventions), in `InvoiceLineItems.jsx`.
- **Voucher-entry grids**: `data-row`/`data-field` DOM attributes + an `advance(row,
  fieldIndex)` helper move focus cell-to-cell on Enter. Native `<select>` cells advance via
  `onChange`, not `onKeyDown` (fighting the native dropdown's own Enter-confirms-selection
  behavior causes bugs). A `pendingFocusRef` + `useEffect` pattern handles focusing a
  brand-new row that doesn't exist in the DOM yet at keypress time.
- **Route-change focus reset**: `DashboardLayout.jsx` blurs `document.activeElement` on every
  `location.pathname` change. **Necessary because `navigate()` never moves DOM focus** — a
  stale focused element (e.g. a previously-clicked sidebar link) would otherwise make
  `isInteractive()` wrongly refuse to fire `Space`/`Backspace` on the new page. (This was a
  real, user-reported bug — fixed once, documented here so it isn't reintroduced.)
- **Persistent hint bar** (`KeyboardHintBar.jsx`) — shows the currently-relevant shortcuts at
  the bottom of forms/modals (e.g. "Enter: Next field/new row · Alt+D: Delete row · Alt+I:
  Insert row above · Ctrl+Enter: Save · Esc: Cancel").
- All of this is hidden under the `@media (max-width: 800px)` breakpoint — meaningless on
  touch devices.

### Create-forms open as modals from list pages (and still work as standalone routes)
`InvoiceForm`, `PartyForm`, `ProductForm` all accept optional `{ onCancel, onSuccess }`
props: `handleSubmit` calls `onSuccess(data)` if provided else `navigate(...)`, and
`handleCancel` calls `onCancel()` if provided else `navigate(...)`. List pages (`InvoiceList`,
`PartyList`, `ProductList`) manage `showCreateModal` state, wire the `Space` shortcut to
open it, and render `<Modal><XForm onCancel={...} onSuccess={handleCreated} /></Modal>` —
the Modal supplies the title chrome.
**Two different patterns for the page wrapper**, worth knowing before editing either form:
- `PartyForm`/`ProductForm` compute `const embedded = Boolean(onCancel)` themselves and
  conditionally skip their own `<div className="page">` wrapper (`if (embedded) return
  formEl;`) — the form component owns that decision.
- `InvoiceForm` never renders a `.page` wrapper itself at all — the standalone route page
  (`CreateInvoice.jsx`, still mounted at `/invoices/new`) supplies it externally, and the
  Modal supplies it when opened from the invoice list page. Don't add a `.page` div inside
  `InvoiceForm` — it would double-wrap the standalone route. (`PurchaseForm`/
  `CreatePurchase.jsx` used to mirror this exact pattern — removed 2026-09-14, see §1.)

### Gotcha: never gate an "edit" save payload field with `|| undefined`
**Bug fixed 2026-09-14, in `CompanyProfile.jsx` and `PartyForm.jsx`.** A pattern like
`phone: form.phone || undefined` looks like a harmless "don't send empty junk" guard, but on
an **edit** form it silently breaks clearing a field: when the user empties the input,
`"" || undefined` becomes `undefined`, and `JSON.stringify` drops `undefined`-valued keys
from the request body entirely. The backend never receives that key, so
`methods.updateById(Model, id, req.body)`'s Mongoose `$set` simply doesn't touch that field —
the old value stays in the database untouched. The UI then reloads the "updated" record and
shows the old value again, which reads as "the field just refuses to clear" / "it comes back
after I remove it." **Fix:** on an edit-save payload, send the field's current value as-is
(including `''`) — never `|| undefined` it. If the backend's Zod schema rejects an empty
string for a formatted field (`z.string().email()`, `z.string().length(15)` for GSTIN, etc.),
loosen it to `z.union([z.literal(''), z.string().email()]).optional()` (see
`updateCompanySchema` in `company.controller.js` and `optionalGstin`/`optionalEmail` in
`party.validator.js`) so `''` is accepted as "clear this field," not rejected as invalid.
**This does NOT apply to list-filter params** (`status || undefined` in a `/invoices/list`
call, `search || undefined` in a party/product search) — there, omitting an empty filter
correctly means "no filter," and is not a bug. Only edit/update payloads for a field the user
can clear are at risk. `InvoiceForm` did not have an edit mode when this bug was fixed, so it
wasn't affected at the time — it does now (added 2026-09-14, see below), and its edit payload
was built without `|| undefined` guards from the start, so it doesn't need this fix either.

### Invoice editing (added 2026-09-14)
Previously invoices were create-only — no way to fix a mistake short of cancelling and
starting over. `InvoiceForm` now detects edit mode itself via `useParams()`
(`isEdit = Boolean(id)`, the same pattern `PartyForm`/`ProductForm` already used) rather
than needing a separate prop:
- **Route:** `/invoices/:id/edit` → `EditInvoice.jsx` (a thin `.page` wrapper, mirroring
  `CreateInvoice.jsx` — `InvoiceForm` still never renders its own `.page` div).
- **Edit is only offered for `status: 'draft'` invoices** — `InvoiceDetail.jsx`'s "Edit"
  button is conditioned on that, matching the "Finalize"/"Cancel" buttons' existing
  conditions. This is deliberate, not a missing feature: once finalized, GST invoices
  shouldn't be silently altered (the backend's `FINANCIAL_FIELDS` list in
  `invoice.controller.js#update` already rejects a financial-field change on a finalized
  invoice — see convention notes there — so the UI just doesn't offer an option that would
  get rejected anyway). No backend changes were needed at all for this feature — `/invoices/
  update` already supported everything required.
- **Reconstructing `gstRate` per line item**: a stored invoice's items don't persist their
  own `gstRate` (only the invoice-level `hsnWiseBreakup` does — see §4's Invoice entry).
  `reconstructGstRate()` in `InvoiceForm.jsx` matches each item's `hsnSac` against
  `hsnWiseBreakup` and derives `igstRate || (cgstRate + sgstRate)`. Best-effort: two line
  items sharing an HSN but taxed at different rates (rare) would both resolve to whichever
  breakup entry matches first — acceptable since it's only a pre-fill and the user reviews
  before saving.
- **`item.product` normalization**: `getInvoiceDetail` populates `items.product` as a full
  Product object (`{ populate: ['buyer', 'items.product'] }` in the controller), but the
  line-items grid's `<select>` needs a bare ID string — populated as
  `item.product?._id || item.product || ''`.
- **Verified live**, not just read: a finalized invoice correctly shows no Edit button; a
  draft invoice's edit form pre-fills every field correctly including the reconstructed
  18% GST rate and the product-linked dropdown selection; saving round-trips through the
  real `/invoices/update` endpoint and lands back on the detail page. (One test-script
  false alarm along the way: `ui.click()` on a snapshot ref taken right as the async
  pre-fill data was still landing/re-rendering the page produced a stale ref that silently
  did nothing — no network request, no error. Clicking the same button via a direct
  `document.querySelector(...).click()` in `page.evaluate()` worked immediately. Not an app
  bug — see the browser-automation skill's own note that refs die on re-render.)

### QA-pass fixes: duplicate-submit guard, silent validation, a stale select race (added 2026-09-15)
A QA pass run via Claude-in-Chrome (browser-only, no filesystem/terminal access — see §10)
against the live app surfaced four real bugs, all now fixed and re-verified live via the
browser-automation skill:

- **Duplicate invoices from a rapid multi-click on "Create Invoice"** (`InvoiceForm.jsx`).
  The button already had `disabled={submitting}`, but that alone doesn't stop a *second*
  click that lands before React re-renders: three `button.click()` calls dispatched
  synchronously in the same tick all invoke the *same* `handleSubmit` closure, because
  React 18 batches the `setSubmitting(true)` state update rather than applying it between
  those synchronous dispatches — so an `if (submitting) return` guard reading that stale
  state still lets all three through. Fix: a `submittingRef = useRef(false)` set
  synchronously at the top of `handleSubmit` (`if (submittingRef.current) return`) and
  cleared in `finally` — a ref mutates immediately, independent of React's render/batching
  cycle, so it's the only thing that actually closes this race. Verified with a
  `page.evaluate()` script firing three raw synchronous clicks: before the fix, 3
  `POST /invoices/create` requests fired (3 duplicate invoices); after, exactly 1. If you
  add a submit-guard to any other form here, use a ref, not state alone — a state-only
  guard looks correct in review and even passes a manually-spaced two-click test, and only
  fails under a truly rapid double-click, which is exactly the case that matters.
- **Product edit form: Unit / GST Rate select never pre-populate** (`ProductForm.jsx`).
  `react-hook-form`'s `reset()` sets an uncontrolled select's value by writing directly to
  the DOM node — which only sticks if a matching option already exists there. The product
  being edited and the `units`/`taxRates` master lists (which supply those options) were
  fetched in two independent, unordered `useEffect`s; whenever the product resolved first,
  `reset()` ran while the select still only had the "Select…" placeholder option, so the
  value silently failed to apply — 100% reproducible whenever that race lost, which in
  practice was every time. Fix: the fetched product is now held in a `pendingProduct` state
  instead of being applied immediately, and a separate `useEffect` depends on
  `[pendingProduct, units, taxRates]` and calls `reset()` on any of them changing — so once
  both the product and the master lists have landed (in either order) and their options are
  actually in the DOM, the next `reset()` call sticks. Same species of bug as the PDF
  full-page-fill saga in §8: a value that looks right in isolation can still lose to render
  timing — verify the actual post-render state, not just that the code that sets it ran.
- **New Product form: GST Rate dropdown silently empty, no explanation** — not a bug in the
  data flow (added 2026-09-16). GST Rate is sourced from the same masters system as Unit
  (`masterApi.listMasters({ type: 'taxRate' })`), and is empty for the identical reason Unit
  can be: no `taxRate` master entries exist yet (Settings → Manage Masters → Type: `taxRate`
  — add entries like Code `GST18`/Label `18%`/Value `18`). The only real bug was that
  `ProductForm.jsx`'s empty-state hint only checked `units.length === 0`, so an empty Unit
  list explained itself while an empty GST Rate list didn't. Fixed by adding the equivalent
  `taxRates.length === 0` hint alongside it.
- **Two forms fail silently on a missing required field — no toast, no request, nothing
  visible** (`EwayBillTracker.jsx`'s manual entry form, `CompanyProfile.jsx`). Both used a
  plain HTML `required` attribute on the `Input` component. Native constraint validation
  does block the browser's submit event before `onSubmit` ever runs, so no bad data ever
  reached the server — but the only feedback is a native browser validation bubble, which
  is invisible to anything reading the page's own DOM (a QA agent, a screen reader in some
  configurations, or a user used to this app's own toast-based validation elsewhere). Fix:
  removed `required` from the affected fields and added explicit
  `if (!field.trim()) { toast.error(...); return; }` checks at the top of each
  `handleSubmit`, matching the pattern `InvoiceForm.jsx` already uses
  (`if (!buyerId) toast.error('Select a buyer.')`). Convention going forward: don't rely on
  bare `required` for validation feedback in this app — pair it with (or replace it with) an
  explicit toast/inline check, so the failure is visible in the DOM, not just as a native
  browser affordance.
- **"Refresh token missing." toast leaks on logout / session expiry** (`axiosClient.js`).
  The silent-refresh call (`POST /auth/refresh`, fired automatically on any 401) itself
  fails with a 401 when there's no refresh cookie — an expected state right after logout or
  session expiry, not a real error — but because that inner request's URL matches
  `isAuthRoute` it skips the retry branch and falls through to the generic
  `toast.error(response.data.message)`, surfacing the backend's raw internal wording on top
  of the redirect-to-login that already happens right after. Fix: that generic toast is now
  skipped specifically when `config.url` includes `/auth/refresh` (real `/auth/login` and
  `/auth/register` failures still show their message normally — only the silent-refresh
  path is suppressed).
- **Empty `()` printed on the PDF when "Buyer's Order No." is blank** — `modern.template.html`
  and `detailed.template.html` unconditionally rendered `{{buyersOrderNo}}
  ({{formatDate buyersOrderDate}})`; wrapped both in `{{#if buyersOrderNo}}`, matching how
  `classic.template.html` already omits the field cleanly. Templates are compiled once and
  cached in memory (`pdf.service.js`), so the backend needed a restart to pick this up.

### `window.confirm` replaced with a proper modal everywhere, plus reference-count delete warnings (added 2026-09-15)
All five destructive-action confirmations (Party delete, Product delete, Invoice cancel,
Manage Masters delete, Manage Fields delete) used the native `window.confirm()`, which
can't be styled, blocks the whole tab synchronously, and reads as "the app froze" to
anything driving the page programmatically (including the browser-automation skill —
native dialogs aren't part of the DOM it inspects). Replaced with
`frontend/src/components/common/ConfirmDialog.jsx`:
- `confirmDialog({ title, message, confirmLabel, cancelLabel, danger })` — an async function
  usable from any event handler exactly like `window.confirm()` was
  (`const ok = await confirmDialog({...}); if (!ok) return;`), but returns a real Promise
  resolved by the user's click instead of blocking the thread. Built on the *existing*
  `Modal.jsx`, not a new dialog implementation, so it inherits the app's real styling,
  Escape-to-close, and overlay-click-to-close for free.
- `ConfirmDialogHost` — one instance mounted in `App.jsx` next to `ToastContainer`, using
  the same singleton emit/listener pattern as `Toast.jsx` (`confirmDialog()` calls a module-
  level `listener` function set by the host's `useEffect`) — so, like `toast`, it needs no
  provider/context wiring at each call site, just an import.
- **Party and Product delete now warn with a real reference count** before deleting
  (previously flagged as a gap in a 2026-09-15 QA pass — deleting a party gave no warning
  it was linked to existing invoices). Both call `invoiceApi.listInvoices({ party: id,
  limit: 1 })` / `{ product: id, limit: 1 })` first and read `.total` from the paginated
  result; if > 0, the message names the count and clarifies that invoices keep their own
  snapshot of buyer/line-item details (see the `|| undefined` gotcha above — this snapshot
  behavior is why deleting a referenced party is *safe*, just worth flagging). This needed
  one small backend addition: `/invoices/list` (`invoice.controller.js`'s `list`, plus
  `listInvoiceSchema` in `invoice.validator.js`) now also accepts a `product` filter
  (`filter['items.product'] = product`), mirroring the `party` filter that already existed.
- Manage Masters / Manage Fields / Invoice Cancel deletes got the same modal with clearer
  wording ("this cannot be undone," and for masters/fields, that already-saved records keep
  their value but the option disappears going forward) but no reference-count lookup — no
  existing endpoint makes that cheap for those entities, and it wasn't the specific gap
  flagged.
- Verified live via browser-automation: the Party-delete modal correctly shows "is used on
  N invoices…" for a party with invoices and the plain "Delete X? This cannot be undone."
  for one without; Cancel closes the modal without deleting; Delete actually deletes
  (confirmed via a disposable test party — created, deleted through the modal, toast fired,
  row gone from the list).
- **If you add another destructive action to this app, use `confirmDialog`, not
  `window.confirm`** — there is no longer a native-dialog usage anywhere in the frontend to
  copy from by accident.

### UI/UX audit fixes: modal stacking, invoice search, inline party creation (added 2026-09-15)
A UI/UX audit run via Claude-in-Chrome (same browser-only methodology as the QA pass above)
surfaced several real issues, now fixed:

- **Invoices had no search at all** — only a status filter and Previous/Next, unlike
  Parties/Products which both have live name search. Added `search` to `/invoices/list`
  (`invoice.controller.js`, `invoice.validator.js`'s `listInvoiceSchema`) matching against
  `invoiceNo` with the same escaped-regex, case-insensitive pattern `party.controller.js`
  already uses for name search — and a matching search box + debounce on
  `InvoiceList.jsx`, with an empty-state message that now distinguishes "no invoices yet"
  from "no invoices match your search/filter" (the old unconditional message was
  misleading once a filter could return zero rows). Buyer-name search was deliberately
  left out of scope — no cheap way to search a populated ref field without an aggregation,
  and invoice number is what the audit specifically flagged as the missing lookup.
- **The confirm-modal button didn't match the action** — `InvoiceDetail.jsx`'s
  "Cancel Invoice" confirmation showed a button labeled "Delete" (the `confirmDialog`
  default) even though the dialog's own title and message said "Cancel". Fixed by passing
  `confirmLabel: 'Cancel Invoice'` explicitly. Worth checking when adding a new
  `confirmDialog` call for something that isn't literally a delete — the default label is
  right for deletes only.
- **No way to add a new party mid-invoice without losing everything already filled in** —
  the Buyer `<select>` only offered existing parties; leaving the page to create one
  elsewhere discarded the whole in-progress invoice with no warning. Fixed with a "+ New"
  button next to the Buyer field on `InvoiceForm.jsx` that opens `PartyForm` (the same
  component `PartyList.jsx` already embeds) in a `Modal`, on top of the invoice form,
  without navigating anywhere — on success the new party is spliced into the in-memory
  `parties` list and selected as the buyer immediately, and the rest of the invoice
  (items, dates, everything) is untouched because nothing unmounted.
- **That inline modal-in-modal (New Invoice → "+ New" Party) exposed a real bug in
  `Modal.jsx`**: two Modals open at once (InvoiceForm's own Modal from `InvoiceList`'s
  "New Invoice" button, plus the new "+ New" Party Modal on top of it) both listened for
  Escape independently on `window`, so pressing Escape while filling in the New Party
  modal closed *both* — discarding the entire in-progress invoice, exactly the data-loss
  bug this feature exists to prevent. Root cause, in order:
  1. `Modal.jsx` previously had no concept of nesting — every open instance's `window`
     keydown listener fired for every Escape press, each unconditionally calling its own
     `onClose`.
  2. Fixed with a module-level `modalStack` (open Modal ids, in open-order): Escape (and
     now also an overlay backdrop click, which needed `e.stopPropagation()` added on the
     overlay's own `onClick` for the same reason) only ever acts on the *topmost* id.
  3. That alone wasn't sufficient — `PartyForm.jsx`/`ProductForm.jsx`/`InvoiceForm.jsx`
     each *also* handle Escape themselves (`handleFormKeyDown`, closing the modal via their
     own `onCancel`), for the standalone-routed-page case where there's no Modal to fall
     back on. That handler runs as a React synthetic event during the bubble phase, which
     always fires *before* `Modal.jsx`'s native `window` listener for the same physical
     keypress. So when embedded, the form's own Escape handling unmounted (and
     stack-popped) the inner Modal early enough that the *outer* Modal's listener, checking
     the stack right after, saw itself as newly-topmost and closed too.
  4. Final fix: each embedded form's own Escape handling is now gated to the standalone
     case only (`!onCancel` in `InvoiceForm.jsx`, `!embedded` in `PartyForm.jsx`/
     `ProductForm.jsx`) — when embedded in a Modal, `Modal.jsx`'s stack-aware `window`
     listener is the *only* thing that closes it, so there's no longer a second mechanism
     racing to pop the stack early. **If you add Escape-handling to another embeddable
     form, gate it the same way** — "harmless to call onClose twice" (the old assumption)
     stops being true the moment modals can nest.
  - This was hard to debug live: neither `console.log` nor a `window.__debugVar` written
    from inside the app were ever observable from the browser-automation script's
    `page.on('console')`/`page.evaluate()` — patchright appears to isolate its evaluation
    context from the page's real one (consistent with it being a stealth/anti-detection
    Playwright fork). Reasoning through the actual event-ordering (React synthetic bubble
    phase vs. native `window` listener) was what actually found the bug; the harness only
    confirmed the *symptom* (both dialogs closing) and, after the fix, the *result* (only
    the inner one does) — don't expect to instrument this app's own JS from that skill.
  - Also fixed while in here: **accumulated headless Chrome processes from many
    browser-automation session launches degraded the same skill's own performance** (page
    loads crept up to 30+ seconds) until the leftover processes — identifiable by
    `ab-sessions` in their command line, the skill's own throwaway-profile marker — were
    killed. Always `--close` a named `--session` when done with it (per the skill's own
    docs), and if things get inexplicably slow mid-session, suspect this before suspecting
    the app.
- **Keyboard hint bars were inconsistent** — `InvoiceForm`/`InvoiceLineItems` advertised
  their shortcuts, but `PartyForm`, `ProductForm`, and `EwayBillTracker` had neither the
  hint bar nor (for Party/Product) actual Ctrl+Enter/Escape handling to back one up. Added
  both to all three, following the InvoiceForm pattern (`EwayBillTracker` isn't ever
  embedded in a Modal, so its own Escape handling — resetting the form to empty, its
  closest equivalent of "cancel" since it's an always-visible inline form, not a modal —
  needed no gating).
- **Custom field key had to be typed by hand** — `FieldConfigForm.jsx`'s Field key input
  didn't auto-populate from the Label the way most form builders' slug fields do. Added a
  `slugify()` that mirrors the key's own "letters, numbers, underscores" constraint,
  auto-filling the key as the Label is typed until the user edits the key field directly
  (tracked via a `fieldKeyTouched` flag), at which point their value sticks.
- Not fixed (flagged in the audit but out of scope for now — genuine design/effort
  tradeoffs, not oversights): the narrow-viewport sidebar/table layout inconsistency (same
  gap as the earlier QA pass's Minor #7). (The other item flagged alongside this one —
  repositioning custom invoice fields on the form — became moot later the same day: the
  whole custom-fields system was removed, see below.)

### Custom-fields system (FieldConfig) and Cloudinary both removed (2026-09-15)
Prompted by two exploratory questions ("do we really need this?") answered by pulling real
usage data instead of guessing. A production-readiness review raised Cloudinary as a
dependency worth questioning; checking the actual database (not just reasoning about it)
showed the company had never uploaded a logo/signature, and separately that **zero
`FieldConfig` documents had ever existed** and `customFields` was `{}` on every invoice ever
created, real or test. Both were removed outright rather than kept "in case they're needed
later" — a generic subsystem nobody has used, discovered via actual data rather than
speculation, is a stronger case for removal than a hypothetical one.

**Custom fields (FieldConfig / "Manage Fields")** — fully removed:
- Backend: `models/FieldConfig.model.js` and `services/dynamicField.service.js` deleted.
  `controllers/fieldConfig.controller.js` (which combined FieldConfig CRUD *and* Master CRUD
  in one file) was rewritten to keep only the Master half, and renamed to
  `controllers/master.controller.js` for clarity now that it's single-purpose — `router.js`
  and everywhere else importing it updated to match. The `/field-configs/*` routes are gone;
  `/masters/*` are untouched. `customFields` removed from the `Party`, `Product`, and
  `Invoice` (both the document itself and each line item in `items[]`) Mongoose schemas, and
  from every relevant Zod validator and controller (`party`, `product`, `invoice`).
  `{{#if customFields.length}}...{{/if}}` blocks removed from all three PDF templates
  (invoice-level in all three; the per-line-item block classic/modern also had).
- Frontend: deleted `pages/settings/ManageFields.jsx`, `components/dynamic/` (both
  `DynamicFieldRenderer.jsx` and `FieldConfigForm.jsx` — the whole folder), and
  `hooks/useFieldConfig.js`. `api/fieldConfig.api.js` (which also combined FieldConfig *and*
  Master API calls) was replaced with `api/master.api.js`, keeping only the Master
  functions — every import site (`InvoiceForm.jsx`, `PartyForm.jsx`, `ProductForm.jsx`,
  `ManageMasters.jsx`) updated from `fieldConfigApi` to `masterApi`. The "Manage Fields" tab
  removed from `SettingsNav.jsx`; its route removed from `AppRoutes.jsx` (a direct visit to
  the old `/settings/fields` URL now falls through to the catch-all redirect to `/`, same as
  any other unknown route). `customFieldValues` state, `DynamicFieldRenderer` usage, and the
  `useFieldConfig` hook call removed from `InvoiceForm.jsx`, `InvoiceLineItems.jsx`,
  `PartyForm.jsx`, and `ProductForm.jsx`.
- No data migration was needed — every stored `customFields` was already `{}`, and removing
  a field from a Mongoose schema doesn't require touching documents that still have the
  (now-untracked, harmless) key in MongoDB itself.
- **If a real custom-field need comes up later, add it as an actual schema field on the
  relevant model** (matching how every other field in this app works) rather than
  reintroducing a generic per-company dynamic-field engine — that engine's entire existence,
  in retrospect, was solving a problem this single-tenant app never actually had.
- **Regression from this removal, found and fixed shortly after**: `Sidebar.jsx`'s
  `SIDEBAR_LINKS` still pointed the "Settings" nav item at `/settings/fields` — that route
  was gone, so clicking Settings silently landed back on the Dashboard via `AppRoutes.jsx`'s
  catch-all `<Route path="*" element={<Navigate to="/" />} />`, with no error of any kind to
  explain why. Fixed by pointing it at `/settings/company` instead. This was missed at
  removal time because the grep sweep done then searched for `ManageFields`/`fieldConfig`/
  `field-configs` — none of which appear in the literal string `/settings/fields` used as a
  route target. **When removing a route, grep for the route's own path string
  specifically** (`/settings/fields`, not just the component/file names associated with it),
  since nothing else about a stale `<NavLink to="...">` would fail loudly — React Router's
  catch-all just quietly redirects instead of erroring.

**Cloudinary** — fully removed, replaced with base64-in-MongoDB:
- The reasoning: Cloudinary was used for exactly two images per company (logo, signature),
  uploaded rarely, consumed only server-side to embed into a PDF. The one legitimate reason
  to use *some* external storage — Render's filesystem is ephemeral, so anything written to
  local disk vanishes on redeploy — doesn't actually point at Cloudinary specifically; it
  points at "store it somewhere that isn't the app's own disk," and MongoDB (already in use,
  already persistent) does that with no new dependency. This also made the behavior
  *consistent* with how the bundled default logo already worked (see the dated note above) —
  a base64 `data:` URI embedded directly in the rendered HTML, so PDF generation never
  depends on network access either way.
- `config/cloudinary.js` deleted. `controllers/company.controller.js`'s `uploadLogo`/
  `uploadSignature` no longer call `cloudinary.uploader.upload_stream`; they convert the
  uploaded buffer to a `data:${mimetype};base64,...` string via a new `bufferToDataUri()`
  helper and store that directly in `Company.logoUrl`/`signatureUrl` (unchanged `String`
  fields — they just hold a different kind of URI now). `env.cloudinary` removed from
  `config/env.js`; `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`
  removed from `.env`, `.env.example`, and `render.yaml`. The `cloudinary` npm package
  removed from `package.json` (via `npm uninstall`, not just editing the file, so
  `package-lock.json` stays correct).
- **New size limit specific to logo/signature**: `router.js` used to reuse the same 15MB
  multer instance for e-way bill uploads *and* logo/signature (15MB sized for real phone-
  camera e-way-bill photos). That's unsafe to reuse now that logo/signature are stored
  directly on the Company document — MongoDB has a hard 16MB-per-document limit, and a 15MB
  image becomes ~20MB once base64-encoded, comfortably exceeding it. Added a second multer
  instance, `uploadImage` (2MB limit, JPEG/PNG/WebP only), used only for
  `/companies/upload-logo` and `/companies/upload-signature`; the original `upload` (15MB,
  also accepts PDF) is still used for e-way bill document parsing, unchanged.
- Verified live end-to-end: uploaded a real PNG through Settings → Company Profile, got
  back a 200 and a `data:image/...;base64,...` `<img src>` that actually rendered; all three
  PDF templates (Classic, Modern, Detailed) still generate real, valid PDFs off a live
  invoice after the `customFields` removal touched their data-assembly code; party/product
  create and edit still work with no `customFields` in the payload; direct navigation to the
  removed `/settings/fields` route redirects cleanly instead of erroring.
- **If Cloudinary (or any external image host) is ever reconsidered, it should be because
  this becomes a real multi-tenant product with many companies uploading larger images at
  volume** — not before. At this app's actual scale, base64-in-Mongo is simpler, has one
  fewer credential to leak, and is strictly more reliable (no external service that can be
  down or slow during PDF generation).

### Logo/signature upload removed entirely (2026-09-15, same day as the Cloudinary swap above)
Replacing Cloudinary with base64-in-Mongo (above) prompted a follow-up question: is the
upload *feature itself* — not just its storage backend — actually needed? The two images
turned out to be different cases:
- **Logo**: the bundled default (`backend/assets/logo-mark.png`) isn't a generic
  placeholder — it's already a custom-cropped version of this company's own logo (see the
  "PDF invoice logo" note further up). So a logo-upload UI was solving an already-solved
  problem: there was nothing a company could usefully upload that wasn't already there.
- **Signature**: had no bundled fallback at all — if `signatureUrl` was unset, the PDF just
  printed "Authorised Signatory" as bare text with no image. Unlike a logo, a signature is
  inherently person-specific and can't be pre-bundled the way a static logo can. Kept as a
  real, if currently-unused, business need right up until this point — the user chose to
  remove it anyway, so both went together for simplicity rather than leaving one half-built.
- Backend: `Company.model.js`'s `logoUrl`/`signatureUrl` fields removed entirely (both are
  now permanently unsettable — no code path writes them anymore). `company.controller.js`'s
  `uploadLogo`/`uploadSignature`/`bufferToDataUri` deleted. `router.js`'s `/companies/
  upload-logo`/`/companies/upload-signature` routes and the `uploadImage` multer instance
  (the 2MB logo/signature-specific limit added alongside the Cloudinary swap) deleted — the
  original `upload` instance (15MB, e-way-bill document parsing) is untouched.
  `invoice.controller.js`'s PDF data assembly now always sets `logoUrl: defaultLogoDataUri`
  unconditionally (no more `company.logoUrl ||` fallback, since `company.logoUrl` can never
  be anything else now) and no longer sets `signatureUrl` at all.
- PDF templates: `{{#if logoUrl}}`/`{{#if ../logoUrl}}` conditionals simplified to an
  unconditional `<img>` in `classic`/`modern` (logo is now always present, so the
  conditional was dead weight — `detailed` never had a logo slot, unchanged). The
  `{{#if signatureUrl}}<img class="signature" .../>{{/if}}` block removed entirely from all
  three templates (it could never be true anymore) — the "Authorised Signatory" text label
  next to it stays. The now-unused `img.signature { ... }` CSS rule removed from each
  template too.
- Frontend: `CompanyProfile.jsx`'s Logo/Authorised Signatory Signature upload section (both
  `<input type="file">` blocks, their preview `<img>`s, and the `handleFileUpload` helper)
  removed. `company.api.js`'s `uploadLogo`/`uploadSignature` (and the `uploadFile` helper
  they shared) removed.
- Verified live: Company Profile page has zero `<input type="file">` elements and no
  Logo/Signature labels left; saving the rest of the profile form still works; PDF
  generation still produces a real, correctly-sized PDF (byte-identical size to before this
  change, since the bundled logo renders exactly the same either way).

### Field-level validation errors weren't reaching the user (fixed 2026-09-15)
Backend validation failures already carried real detail — `validate.middleware.js` builds
`errors: [{field, message}]` from every failed Zod check and `error.middleware.js` sends it
alongside the response — but nothing on the frontend ever read that array. Every validation
failure anywhere in the app, no matter how specific the underlying Zod issue actually was,
showed the same bare **"Validation failed."** toast, because `axiosClient.js`'s response
interceptor only ever read the generic top-level `message`. This is the concrete version of
the "not like 'something went wrong'" complaint — confirmed nothing else in the app actually
had that problem first, via a 119-request negative-test sweep across every endpoint (see
§10) that found zero raw 500s and otherwise-specific messages everywhere except here.
- New `frontend/src/utils/apiError.js#formatApiErrorMessage(data, fallback)` — builds a real
  message from the `errors` array: one field error renders as just `"Field: reason"` (no
  generic prefix at all); multiple render as `"Validation failed. Field1: reason1; Field2:
  reason2; ..."`. Falls back to the plain top-level `message` when there's no `errors` array
  (i.e. every *non*-validation error — "Buyer not found.", "Invoice not found.", "A 'unit'
  master with code 'KG' already exists." — was already specific and is untouched by this
  change), and to a generic string only when there's no response data at all (a real network
  failure, not a validation error). Field names get light humanization for readability
  (`stateCode` → `State Code`) plus a small lookup for domain acronyms this app uses
  constantly (`gstin` → `GSTIN`, `hsnSac` → `HSN/SAC`, `pan` → `PAN`, `ifsc` → `IFSC`) —
  nested/array field paths (`items.0.quantity`) are left as-is rather than guessed at.
  `Login.jsx`'s two local `catch` blocks (the only other place in the frontend that read
  `err.response?.data?.message` directly, bypassing the interceptor's toast since Login has
  its own inline `.error-banner`) use the same helper now, for the same reason.
- Verified live by calling the real backend directly (not just reading the code): a single
  bad field (`gstin: 'TOOSHORT'`) now renders as `"GSTIN: String must contain exactly 15
  character(s)"`; a payload with six simultaneous failures renders every one of them,
  labeled. Genuine not-found/conflict/business-rule errors are confirmed unchanged.
- **If you add a new form or API call, nothing extra is needed to get this** — any error
  that flows through `axiosClient.js` (i.e., basically everything) already gets the
  formatted message for free. Only reach for `formatApiErrorMessage` directly if you're
  building a local inline error display outside of the toast, the way `Login.jsx` does.

### Custom `DatePicker` component, replacing native `<input type="date">` (added 2026-09-15)
The Dashboard's Sales Report "From"/"To" fields used the browser's native date input, whose
calendar popup is entirely closed to CSS — no amount of styling can make it match this
app's ledger/paper design system (Ink Navy, IBM Plex Mono for numbers, etc.), so it always
looked like generic browser chrome dropped into an otherwise custom-designed page.
- New `frontend/src/components/common/DatePicker.jsx` — a self-built month-grid calendar
  (no date-picker library pulled in; the grid math is plain `Date` arithmetic, small enough
  not to be worth a dependency). Same contract as the native input it replaces: value in/out
  is still a plain `'yyyy-mm-dd'` string, so callers don't need to change how they store it
  — `Dashboard.jsx`'s `from`/`to` state and `loadReport()` are unchanged, only the two
  `<input type="date">` elements were swapped for `<DatePicker value={from} onChange=
  {setFrom} label="From" />` (and the same for `to`).
- Visually: the trigger is styled as a normal `.input` (so it sits flush with every other
  form field), showing the same `formatDate`-style display ("15 Sep 2026") the rest of the
  app already uses once a value is picked, or a muted "Select date" placeholder before that.
  The popup below it uses Ink Navy for the month header and the selected day, IBM Plex Mono
  + `tabular-nums` for the day grid (matching how every other number in this app is styled),
  a thin Ink Navy ring on today's date, and Clear/Today footer shortcuts styled as
  `.btn-text` — mirroring the native picker's own affordances so nothing about the
  *behavior* is unfamiliar, only the look.
- Behavior: click the trigger to open, click a day to select and close, click outside or
  press Escape to close without changing anything, prev/next arrows page months without
  losing the currently-selected day. The grid is always a fixed 6 rows (padding in adjacent-
  month days, dimmed) so the popup's height never jumps as you page between months.
- Verified live: opened the popup, paged to the previous month and back, selected a day
  (confirmed the trigger then displays it correctly formatted and the popup closes),
  confirmed click-outside closes it, used the Today shortcut, and confirmed Apply still
  reloads the Sales Report with real data afterward — all with zero console errors.
- **If another date field in the app wants this same treatment, reuse this component**
  rather than building another one-off calendar — it doesn't currently support a min/max
  date range or keyboard arrow-key navigation between days (Escape-to-close is the only
  keyboard affordance), so extend it in place if one of those is ever needed rather than
  forking it.

### Buttons redesigned — hover/active/focus states, a new `success` variant (added 2026-09-15)
Every button in the app shared four CSS classes (`.btn-primary/-secondary/-danger/-text`)
that had **zero interactive states at all** — no `:hover`, no `:active`, no `:focus-visible`,
no transitions — so every button felt flat/generic regardless of how the rest of the page
was styled, and keyboard users got no focus indication on buttons at all (an accessibility
gap, not just a visual one). This is a CSS-only change — `Button.jsx` itself is untouched,
and since virtually every button in the app (including raw `<button className="btn
btn-secondary">` elements outside the `<Button>` component — pagination, row-action
Edit/Delete links) shares these same classes, the redesign applies everywhere automatically
with no JSX changes needed except the one deliberate variant swap noted below.
- **Primary** (Ink Navy): gains a subtle rest-state shadow, lifts (`translateY(-1px)`) with
  a stronger shadow on hover, and presses back down with a darker fill on `:active`.
  **Secondary** (outlined): tints toward Paper White on hover, a touch darker on `:active`.
  **Text** (row-action links): gets a soft Paper White hover backdrop it never had before —
  previously hovering "Edit"/"Delete" in a table row gave zero feedback at all.
- **Danger stays outlined at rest, fills solid Stamp Red on hover/focus** — deliberately not
  filled red all the time, which would make every destructive action shout for attention
  constantly; it only fills in right when a user is actually about to act on it.
- **New `success` variant** (Ledger Green — the same green already used for the
  `badge-finalized` status badge). Applied to exactly one button: `InvoiceDetail.jsx`'s
  "Finalize" (was plain Ink Navy primary before, visually identical to every routine Save
  button in the app). Finalizing a draft now visually leads straight into the badge color
  it produces, instead of looking like any other form submit.
- Hover/active colors use `color-mix(in srgb, var(--color-ink-navy) 85%, white)` (etc.)
  rather than hand-picked new hex values — keeps every shade derived from the same four
  design tokens (`--color-ink-navy`, `--color-ledger-green`, `--color-stamp-red`,
  `--color-paper-white`) as a single source of truth, so a future token change (e.g.
  rebranding Ink Navy) automatically updates every hover/active shade with it.
  `color-mix()` needs a reasonably modern browser (Chrome 111+/Firefox 113+/Safari
  16.2+, all from 2023) — not a concern for this app's target browsers.
- Added a `.btn:focus-visible` outline (2px solid Ink Navy, matching the focus-ring
  convention already used elsewhere in `index.css`) — every button is now keyboard-focus-
  visible, which none of them were before this pass.
- Verified live: computed-style checks confirmed the primary/success/danger backgrounds
  actually change color and gain a box-shadow on `:hover` (not just that the CSS rules
  exist un-triggered), and a screenshot of the invoice detail page's action row + a hovered
  row-action "Delete" link on the Parties list both confirm the visual result reads as
  intentional and consistent, not the flat, undifferentiated look from before.

### Custom `Select` component (added 2026-09-15) + a DatePicker button styling bug fixed
Same problem as `DatePicker.jsx` (§6, 2026-09-15) applied to `<select>`: the closed box
already inherited `.input` styling fine, but the *open options list* is entirely native
OS/browser chrome — no CSS can touch it, so it always looked out of place next to the rest
of a custom-designed page (most visibly the blue-highlighted native list on the Invoices
status filter).
- New `frontend/src/components/common/Select.jsx` — same interaction shape as
  `DatePicker.jsx` (click trigger → custom popup, click option to select and close, click-
  outside/Escape to close, no arrow-key navigation yet). Props: `value`, `onChange`,
  `options: [{value, label}]`, optional `label`/`placeholder`. Popup styling matches
  `DatePicker`'s popup (white, Rule Grey border, same shadow) — the selected option gets
  the Ink Navy fill also used for a selected calendar day, keeping both "open a custom
  panel from a form field" components visually consistent with each other.
- **Deliberately scoped to two dropdowns, not applied app-wide** — `InvoiceList.jsx`'s
  status filter and `ManageMasters.jsx`'s type filter, both plain `useState`-controlled.
  Two other groups of `<select>` elements in the app were deliberately left native:
  - **react-hook-form-registered selects** (`PartyForm.jsx`'s Type, `ProductForm.jsx`'s
    Unit/GST Rate) — these spread `register('field')`'s `{name, onChange, onBlur, ref}`
    directly onto a native `<select>`; swapping in a non-native control would need
    react-hook-form's `Controller` to rewire it, which is real added complexity, not a
    drop-in change.
  - **`InvoiceLineItems.jsx`'s Product/GST% selects** — deliberately left alone. That
    file's own top comment already documents relying on genuine native `<select>` behavior
    (native Enter-to-confirm, native type-to-jump) as part of the keyboard-first voucher-
    entry grid — replacing them risks breaking a heavily-tested keyboard flow for a purely
    visual gain on a field most users interact with by keyboard, not by looking at it.
  If either of those is ever wanted with this same visual treatment, it needs its own
  careful pass (Controller-wiring for the form ones; deliberate keyboard-behavior
  preservation for the line-items ones) — don't assume `Select.jsx` is a safe drop-in
  replacement for every `<select>` in the app.
- **Also fixed while in here**: `DatePicker.jsx`'s "Clear"/"Today" footer buttons used
  `className="btn-text"` alone (missing the base `"btn"` class), so they never got `.btn`'s
  `border: 1px solid transparent` reset — the browser's native default button border was
  showing through as a visible box around each one. Fixed by adding the missing `"btn"`
  class. The prev/next month nav buttons' `‹`/`›` text glyphs were also swapped for small
  SVG chevrons (matching the calendar-icon treatment already used on the trigger), and
  given the same hover/active transition treatment as the redesigned buttons above, which
  they'd been missing.
- Verified live: selecting a status/type option through the new dropdowns actually filters
  the list correctly (not just that the popup opens); a computed-style check confirmed the
  Clear/Today buttons' border is now the intentional transparent one from `.btn` and their
  hover background actually changes; screenshots confirm both the open Select popup and the
  fixed DatePicker footer read as intentional custom design now.

### Dashboard: a genuine duplicate API call, found via DevTools and fixed (2026-09-16)
The user noticed the Network tab showing the same endpoints firing repeatedly and asked
whether something was looping. It wasn't a loop — confirmed live by watching network
traffic while the app sat idle on a page for 10s: zero requests fired, nothing polls. Most
of what looked suspicious is `main.jsx`'s `<React.StrictMode>` (present from the start of
this project), which intentionally double-invokes effects in dev — every fetch normally
fires twice, dev-only, harmless by design, gone in a production build. **But one genuine
redundancy was hiding under that noise**: `Dashboard.jsx`'s mount effect fired
`reportApi.gstSummary` **twice** with *identical* parameters — once directly for the KPI
row's "GST Payable" figure (`gstSummary({})`, always all-time), and once via `loadReport()`
being called right after for the Sales Report section below, whose own `from`/`to` filter
state is empty on first mount, making its params `{from: undefined, to: undefined}` —
functionally the same all-time request as the KPI's, just spelled differently. Confirmed via
live request-count checks: `gst-summary` fired 4 times on a fresh Dashboard load (2× the
expected 2 from StrictMode alone) before the fix, exactly 2 after it.
- **Fix:** the mount effect now fetches everything it needs in a single `Promise.all`
  (`salesRegister` month-to-date for the KPI, `invoices/list` for the draft count,
  `gstSummary({})` once, and `salesRegister({})` once for the report section's all-time
  default) and populates *both* the KPI state and the report-section state from those same
  results — no more calling `loadReport()` redundantly on mount. `loadReport()` itself is
  untouched and still does the real work when the user actually changes the date filter and
  clicks Apply.
- **`salesRegister` firing 4 times (2× per mount) was NOT touched — that one's correct, not
  a bug.** The KPI row deliberately wants month-to-date sales (`{from: firstOfMonth}`) while
  the Sales Report section defaults to all-time (`{}`) — two genuinely different queries
  that happen to share a name, not an accidental duplicate the way the `gstSummary` calls
  were. Don't "fix" that into one call without changing what either section is supposed to
  show.
- Verified live: `gst-summary` request count dropped from 4 to 2 on a fresh Dashboard load;
  the KPI row's "GST Payable" and the Sales Report section's own "GST Payable" figure still
  matched each other afterward (both read `74,281.26` off the real data) — confirming the
  refactor didn't silently break either value while removing the duplicate fetch; clicking
  "Apply" still fires exactly the expected `gst-summary` + `sales-register` pair via the
  untouched `loadReport()`.
- In a real (non-StrictMode-doubled) production build, this removes exactly one redundant
  HTTP request from every Dashboard page load — modest, but it was genuinely wasted work,
  not just visual noise in DevTools.

---

## 7. E-Way Bill OCR auto-fill (added 2026-09-12/13)

**What it does:** on the E-Way Bill tracker (`EwayBillTracker.jsx`), after selecting a
pending invoice, the user can upload the e-way bill document they downloaded from
the government e-Way Bill portal (PDF, or a photo/screenshot). The backend extracts as many
fields as it confidently can — `ewbNo, generatedDate, validUpto, vehicleNo,
transporterName, distance` — and pre-fills the (still fully editable) form. The user reviews
and clicks Save as normal; nothing is auto-submitted.

**Backend pipeline** (`backend/services/ewaybillOcr.service.js`):
1. If the upload is a PDF: try `pdf-parse` (`PDFParse.getText()`) first. Real government-
   portal EWB PDFs carry a genuine selectable text layer (they're not scans), so this is
   fast (~150ms) and byte-exact — no OCR involved for the common case.
2. If that yields too little text (< 40 chars — a scanned/flattened PDF with no text layer),
   fall back to rasterizing page 1 via `PDFParse.getScreenshot()` (uses `@napi-rs/canvas`,
   which `pdf-parse` v2 bundles as a dependency — prebuilt native binary, no Windows build
   tools needed) and OCR'ing that image.
3. If the upload is a plain image (jpg/png/webp), OCR it directly.
4. OCR itself is `tesseract.js` (`createWorker('eng', 1, { cachePath:
   '<cwd>/.tesseract-cache' })` — gitignored). Downloads English training data from a CDN on
   first use (needs network access once).
5. `parseEwayBillFields(text)` — regex-based extraction against the standard EWB-01 label
   layout (`e-Way Bill No.`, `e-Way Bill Date`, `Valid Until`, `Approx Distance (in KM)`,
   `Vehicle No.`, `Transporter Name`). Dates normalized to `YYYY-MM-DD`.
   **Known OCR gotcha handled:** vehicle plates are parsed as 4 separate regex groups
   (state-letters / RTO-digits / series-letters / serial-digits) so that a digit-fixup pass
   (`O→0`, `I`/`L`→`1`) only ever touches the two digit segments, never the letter segments —
   this fixes the classic OCR confusion (e.g. "GJO1AB1234" → "GJ01AB1234") without corrupting
   correctly-read letters.
6. If zero fields are found, the endpoint returns a 400 with a friendly message asking the
   user to try the original PDF or a clearer photo, rather than silently returning nothing.

**Route:** `POST /api/v1/ewaybills/parse`, multipart (`upload.single('file')`, the same
shared multer middleware used for logo/signature uploads — 15MB limit, jpeg/png/webp/pdf
only). Controller: `ewaybill.controller.js#parseDocument`.

**Severe bug fixed 2026-09-14: a bad image crashed the entire backend, not just this
request.** User report was "e-way upload file is not working." Reproduced by POSTing a
6MB file with an `image/jpeg` mimetype but non-image bytes: multer's fileFilter only checks
the declared mimetype header, not real content, so it passed through to `tesseract.js`'s
`worker.recognize(buffer)`. When tesseract's decoder can't parse the bytes, it does **not**
reject the `recognize()` promise — it emits an `'error'` event on its internal Worker with
no listener attached, which Node re-throws via `process.nextTick` as an **uncaught
exception that kills the whole process**. Every other request/user goes down with it until
someone manually restarts the server — this is a much bigger blast radius than "OCR fails
for one file." (Original 5MB limit was also raised to 15MB in the same fix — real phone
camera photos routinely exceed 5MB, though that alone was a normal 400, not the crash.)
**Fix, in `ewaybillOcr.service.js`:** two layers, both worth keeping —
1. `assertDecodableImage(buffer)` — decodes the buffer with `@napi-rs/canvas`'s
   `loadImage()` (a real Promise that properly rejects on bad data) *before* tesseract ever
   sees it. Catches the common case with a clean `ApiError.badRequest`.
2. `recognizeSafely(worker, buffer)` — defense in depth in case something still slips past
   #1: wraps the `recognize()` call with a scoped `process.once('uncaughtException', ...)`
   that intercepts the otherwise-fatal throw and turns it into a normal promise rejection,
   removing the listener immediately after (success or failure) so it doesn't swallow
   unrelated errors elsewhere in the app. This is a known, deliberate pattern for
   containing a misbehaving library that throws via an unlistened EventEmitter — don't
   remove it thinking it's dead code or an anti-pattern; it's the actual crash guard.
**Verified the fix, not just the theory:** the exact 6MB malformed file that previously
crashed the server now returns a clean 400 (`"Couldn't read that image file…"`) and the
server stays up (confirmed via a follow-up request succeeding); a valid image still OCRs
correctly; a large (2.4MB, 4000×3000) valid image processes without crashing (~13s, no
timeout); the real browser UI shows the error as a toast, not a hang or a blank failure.
If you touch this file again and are tempted to simplify away the `recognizeSafely` wrapper
because "the try/catch around `ocrImage` should already handle it" — it doesn't, that's
the whole point; re-read this note before removing it.

**General lesson worth remembering beyond this one file:** any Node.js library that wraps
`worker_threads` or spawns child processes for CPU-bound work (image/PDF processing, native
addons) is a candidate for this exact failure class — a worker-side error that surfaces as
an uncaught process-level exception instead of a normal promise rejection. If a future
feature adds another such library, check whether malformed input can crash the process the
same way before assuming a try/catch around the call is sufficient.

**Frontend:** `ewaybill.api.js#parseEwayBillDocument(file)` (FormData POST). In
`EwayBillTracker.jsx`, `handleDocumentUpload` calls it, merges only the fields the response
actually returned into form state (leaving the rest untouched), and shows a toast listing
which fields were read. A `Valid Until` date field was added to this form as part of this
work — it existed on the `EwayBill` model and in `createEwayBillSchema` already, but the UI
never exposed it before.

**Dependencies added:** `pdf-parse@^2.4.5` (bundles `@napi-rs/canvas` + `pdfjs-dist`),
`tesseract.js@^7.0.0` — both in `backend/package.json`. `.tesseract-cache/` added to
`backend/.gitignore`.

**Verified (not just written):** a real Puppeteer-generated text-layer PDF through the fast
path (all 6 fields, ~184ms); a synthetic photo through the OCR fallback path (initially 5/6
fields, then 6/6 after the vehicle-plate digit-fixup fix); the full browser UI flow
(upload → auto-fill → review → Save → persisted correctly); the "nothing readable" error path
(blank image → clean 400, no crash).

---

## 8. PDF invoice generation, and Reports

- Templates: `backend/templates/invoice/{classic,modern,detailed}.template.html` —
  Handlebars, rendered server-side, Puppeteer prints to PDF. (A mirrored
  `backend/templates/purchase/` directory existed before 2026-09-14 — removed, see §1.)
- `classic` is the one pinned to the user's reference image (see convention #15) — treat it
  as visually locked unless explicitly asked to change it. It has since been modified twice
  beyond the original reference image, both by explicit user request (2026-09-14, see
  "Two statutory copies per PDF" below) — the reference-image lock applies to the per-copy
  layout/fields, not to those two additions.
- Controller data assembly (`invoice.controller.js#downloadPdf`): `companyName` is always
  the authenticated company's own name (`company.name`), decoupled from the `seller`/`buyer`
  role fields used elsewhere in the same data object — so the PDF's own letterhead branding
  is always correct. Also includes `commonUnitOf(items)` (the shared unit string across all
  line items, or `''` if they differ), individual `cgstRate/sgstRate/igstRate`,
  `taxableValue`, `totalTaxAmount`, and company `tagline/email/website` + a `hasContactInfo`
  boolean gating the footer contact band (`company.phone` is fetched but deliberately not
  passed to the template — see the contact-band note below).
- Custom Handlebars helpers (`pdf.service.js`): `formatDateDash` (`DD-Mon-YYYY`), `qty`
  (2-decimal), `signedAmount` (`(+)`/`(-)` prefixed, Indian-grouped), plus a pre-existing
  `currency` helper.

### Gotcha: a bad character in invoiceNo can 500 the whole PDF download (fixed 2026-09-14)
A real invoice's `invoiceNo` was found stored as `"GST-0002\n"` — a trailing newline. Node's
`ServerResponse.setHeader()` throws `ERR_INVALID_CHAR` outright on a control character in a
header value (Content-Disposition here), which isn't caught by anything specific and falls
through to the generic 500 (`"Something went wrong"`) — the real error only shows up in
server logs, not the client response. **Root cause was never pinned down**: `invoiceNo` is
never client-supplied (`update` explicitly does `delete fields.invoiceNo` before applying an
update — grep for it in `invoice.controller.js` if you don't believe it) and the schema
already has `trim: true` on that field, which normally strips this via Mongoose's setter on
`.create()`/`.save()` — so a raw MongoDB write bypassing Mongoose (a native driver
`updateOne`, not going through `methods.js`) is the most likely explanation, but no such
write was found in this codebase. Fixed two ways: (1) the specific corrupted document was
repaired directly in the DB; (2) `invoice.controller.js#downloadPdf` now sanitizes with a
`safeFilenamePart()` helper (strips `\r`, `\n`, `"` and trims) before building the
Content-Disposition header, so a similarly-corrupted `invoiceNo` — however it happens — can
never crash a PDF download again. If you see another field-corruption bug like this one, the
Counter's `prefix` field (also `trim: true`, also only ever set via `$setOnInsert`) is worth
checking too — it feeds directly into every generated `invoiceNo`.

### Two statutory copies per PDF, full-height page, no phone/thank-you (added 2026-09-14)
At the user's explicit request, `classic.template.html` (invoice only — `modern`/`detailed`
not touched, since the user is demonstrably only using `classic`) now does three things
differently from the original reference-image build:
1. **Every downloaded/printed invoice PDF contains two pages, not one** — "Original for
   Recipient" then "Duplicate for Transporter" — matching how these are physically handed
   out (buyer keeps one, transporter carries the other). `invoice.controller.js#downloadPdf`
   passes `copies: ['Original for Recipient', 'Duplicate for Transporter']` (a fixed array,
   not read from the stored `invoice.copyType` field — that field still exists on the model
   but is no longer read for PDF rendering). The template wraps its entire former body in
   `{{#each copies}}<div class="page...">...{{this}}...</div>{{/each}}`, with
   `page-break-after: always` on every page but the last (`{{#unless @last}}`). Inside the
   loop, every reference to top-level data had to become `{{../fieldName}}` (Handlebars
   context shift) — if you add a new field to this template, remember the `../` prefix or it
   will silently render blank instead of erroring.
2. **A short (1-2 item) invoice now spreads out to use most of the printable A4 height
   (277mm = 297mm page − 2×10mm `@page` margin) instead of leaving a cramped block at the
   top with dead white space below.** The final approach: generous padding inside every
   table cell only (`.header-table td`, `.items-table th/td`, `.words-table td`, `.hsn-table
   th/td`, `.footer-info-table td` — all bumped up from the original reference-image's
   tight values) plus a little breathing room around `.top-band`/`.invoice-box`/
   `.page-footer` (the three top-level blocks that sit OUTSIDE the continuous bordered
   ledger). **Deliberately NOT** a `margin-top` between the ~6 tables stacked inside
   `.invoice-box` — that was tried and immediately rejected once the user saw it: those
   tables are meant to be flush against each other so their borders touch and form one
   seamless ruled box (matching the reference image, convention #15); a margin between them
   put a visible white gap through every internal dividing line and the outer box outline,
   breaking the "boxed ledger" look the whole template is pinned to. All spreading comes
   from cell padding alone now, which stays inside each border and never breaks continuity.
   Fill dropped a bit as a result (88.9% vs. 95.1% with the rejected inter-table margins)
   — that's the correct tradeoff; unbroken borders matter more than a few extra percent of
   page coverage. **This was NOT the first approach tried, and the debugging story below is
   worth reading in full before changing this layout again — it cost a lot of back-and-forth,
   more than once from trusting the wrong kind of evidence:**
   - **Attempt 1: flexbox** (`.page { display:flex; flex-direction:column;
     min-height:277mm; }` + `.spacer { flex:1 1 auto; }`) to pin the footer to the bottom
     edge. Measured via `page.evaluate(() => el.getBoundingClientRect())` as filling
     perfectly (gap ~0.00002px). Declared fixed. **The user then reported it was still
     visibly broken, with a real screenshot proving it** — the live-DOM measurement was
     measuring the *on-screen* layout engine's calculation, not what `page.pdf()` actually
     produces. **Lesson: a `getBoundingClientRect()` check on the live DOM proves nothing
     about what `page.pdf()` will render — Chromium's print-pagination pass is a separate
     code path that does not reliably honor flexbox space-distribution.**
   - **Attempt 2: `position:absolute` on a `position:relative; height:277mm` div**, same
     goal. Same failure, this time checked by reading the actual PDF via this tool's own
     preview — still showed a gap.
   - **Attempt 3: a 3-row HTML table** (top row = content, middle row `height:100%` =
     spacer, bottom row = footer) — same bottom-pinning goal, different CSS technique. Based
     on the same PDF-preview glance, this *looked* like it also failed, so it was abandoned
     for a 4th attempt. **It actually hadn't failed** — confirmed much later by rasterizing
     the PDF with a completely independent renderer (`pdf-parse`'s
     `PDFParse.getScreenshot()`, not this tool's own preview code path) and scanning the
     resulting PNG pixel-by-pixel for the lowest non-white row: attempt 3 measured 96.5%
     page fill, already correct. **Lesson: eyeballing this tool's PDF-preview render at a
     glance is not trustworthy for fine-grained fill questions — it had been misread at
     every single attempt in this session, not just the first.**
   - **Attempt 4: a `page.evaluate()`-computed literal pixel height** injected into an empty
     spacer div right before `page.pdf()` (added to `pdf.service.js#renderPdf()`), built to
     replace the wrongly-declared-failed attempt 3. Measured (via the same independent
     rasterize-and-scan method, finally applied correctly) at only ~64% fill — worse than
     attempt 3. Reverted; the injection code was removed from `pdf.service.js` again.
   - **At this point attempt 3 (the table) was restored, re-verified via the independent
     rasterizer at 96.5% — genuinely correct this time — and shipped. The user then looked
     at the real output and said it still didn't look right**, and a screenshot made the
     actual problem obvious: pinning the footer to the literal bottom edge doesn't remove
     empty space for a short invoice, it just relocates all of it into one large ugly gap
     in the middle of the page, between the content and the now-bottom-pinned footer. Asked
     directly, the user wanted the content itself spread out with no single dead zone, not
     a footer glued to the bottom — see the "Recommended" option in that
     `AskUserQuestion`. **The table/pinning technique was removed entirely** and replaced
     with the padding/margin approach described above. Verified the same rigorous way: the
     independent rasterizer found no gap larger than ~68px anywhere in the page (vs. one
     ~470px dead zone with the pinning approach), confirming genuinely even spacing, not
     just a high "last ink row" number (a page can score well on "how far down does content
     reach" while still having one huge gap in the middle — measure gap *distribution*, not
     just the endpoint, when the actual complaint is about a dead zone).
   - **One more round after that**: spreading the content via `margin-top` between the
     inner tables (rather than padding) shipped next, and measured well (95.1% fill, no
     dead zone) — but the user immediately caught something the pixel-fill metric couldn't
     see at all: it broke every internal border line and the outer box outline into visibly
     disconnected segments, since the margin put a gap exactly where two tables' borders
     used to touch and merge into one line. Fixed by dropping the inter-table margin
     entirely and getting all the spreading from cell padding instead (padding stays inside
     a border, so it can never split one) — see the CSS comment on `.invoice-box` for the
     detail. Fill settled at 88.9%, slightly less than 95.1%, which is the right trade.
   - **Root lesson, stated plainly, for next time:** (a) a live-DOM
     `getBoundingClientRect()` check proves nothing about what `page.pdf()` renders; (b)
     eyeballing this tool's PDF-preview at a glance is not reliable for fill questions —
     rasterize with an independent renderer (`pdf-parse`'s `getScreenshot()`) and measure
     pixels programmatically instead; (c) "does it reach the bottom" and "does it look
     right" are different questions — a technique that maximizes fill can still look worse
     than one that doesn't, if it concentrates the empty space instead of distributing it;
     (d) a numeric fill/gap measurement can look perfect while a *different* visual property
     (like border continuity) silently breaks — pixel-fill metrics and "does it look right"
     are not the same check, and only one of them was being measured here; confirm what the
     user actually means, and look at the whole rendered page yourself, before declaring a
     layout change done.
3. **The footer contact band no longer shows a phone number or "Thank you for your
   business!"** — both removed from `classic.template.html` outright (not just hidden).
   Only email/website remain in `.contact-items` (each still individually conditional).
   `hasContactInfo` in `invoice.controller.js` was narrowed from
   `Boolean(company.phone || company.email || company.website)` to
   `Boolean(company.email || company.website)` to match — a company with only a phone
   number configured would otherwise still render an empty dark band with nothing in it.

**Regression this caused, fixed the same day**: adding `copies: [...]` to the PDF data
object and switching `classic.template.html` to `{{#each copies}}` meant `copyType` was no
longer being sent to the template at all. `classic` itself doesn't need it anymore (reads
`{{this}}` inside the loop instead), but `modern.template.html` and `detailed.template.html`
were never updated to the multi-copy pattern — they still read a single `{{copyType}}`
directly, so picking either of those as the company's active template would have silently
rendered an empty copy-type label. Fixed by adding back `copyType: 'Original for Recipient'`
to the data object alongside `copies` — cheap backward-compat for two templates that aren't
in active use, rather than rebuilding either of them to match classic's loop structure.

### Template preview thumbnails (added 2026-09-14)
The Templates settings page (`TemplatePreviewCard.jsx`) previously showed only text
descriptions for `classic`/`modern`/`detailed` — no visual reference at all. Fixed with
real static PNG thumbnails, not a live preview endpoint (none exists — see
`template.controller.js`'s own comment: "no DB-backed CRUD, only selection", the three
layouts are fixed/code-defined for v1). `frontend/public/template-previews/{classic,modern,
detailed}.png` were generated **once**, offline, by rendering each real template through
Puppeteer with realistic two-line-item sample data (same helpers as `pdf.service.js`,
copy-pasted into a throwaway script — not a reimplementation of the render logic, the exact
same Handlebars compile) and screenshotting: for `classic`, just the first `.page` element
(it repeats the whole invoice twice for its two copies — screenshotting the whole body
would have shown the second copy's header bleeding into the thumbnail); for `modern`/
`detailed`, the whole page, since neither has that per-copy wrapper. Downscaled to 500px
wide via `@napi-rs/canvas` (already a transitive dep — see the e-way bill OCR section) and
saved as flat files. `TemplatePreviewCard.jsx` just references `/template-previews/
${template.key}.png` — no backend involvement at request time. **If any template's HTML/CSS
changes, these thumbnails go stale and need re-generating the same way** — there's no
build step or script committed for this (it was a one-off), so recreate it if needed rather
than hand-editing the PNGs. `.template-thumb` CSS deliberately uses `height: auto` (each
PNG's own natural aspect ratio), not a forced uniform box — `classic`'s render is shorter
than `modern`/`detailed`'s (573px vs. 707px tall at the same 500px width), and an earlier
`object-fit: cover` attempt to unify them into one box zoomed `classic` in relative to the
other two, which is actively misleading for something whose entire purpose is showing an
accurate reference.

### Reports & GST Summary — folded into Dashboard, no separate nav item (since 2026-09-14)
`report.controller.js` has `salesRegister` and `gstSummary` (a `purchaseRegister` handler
existed before Purchases was removed — see §1). `gstSummary` used to net sales output tax
against purchase input tax into a `netGstPayable` figure; with no purchase data, it now just
sums invoice CGST+SGST+IGST and returns `{ output, outputTax, gstPayable }` where
`gstPayable === outputTax`. **This is a real simplification, not just a rename** — if this
business ever needs to claim input tax credit again, GST law requires netting it against
output tax, and that math has no purchase-side data to draw on until/unless Purchases (or an
equivalent input-tax data source) comes back.

There used to be a standalone `Reports.jsx` page (`/reports` route, its own sidebar nav
item) with a GST Summary / Sales Register tab pair. **Removed entirely later the same day**,
at the user's explicit request ("Dont give seprate report nav just set it into dashboard so
its easy for them in terms of uX") — `pages/reports/` is gone, the `/reports` route is gone
(falls through to the `*` → `/` redirect, doesn't error), and the "Reports" `SIDEBAR_LINKS`
entry is gone (§6's keyboard-shortcut note above has the renumbering). Its content now lives
directly on `Dashboard.jsx`, below the existing 3-KPI row: a "Sales Report" heading, the
same From/To/Apply date filter, a 2-KPI summary (Taxable Value, GST Payable — for the
selected period, separate from the top row's always-unfiltered GST Payable figure), and the
full Sales Register table. `Dashboard.jsx` now has two independent loading states —
`loading` for the top KPI row (always current month / all-time, fetched once on mount) and
`reportLoading` for the date-filtered section below (`loadReport()`, re-run on "Apply") — so
adjusting the date filter doesn't re-flash the whole page. Also unchanged from the earlier
Purchases-removal work: `Dashboard.jsx`'s "Draft Invoices" KPI (count of `status: 'draft'`
invoices) replacing what used to be "Outstanding Payables" before Purchases was removed.

---

## 9. Local development environment

- **Two dev servers, run independently, no orchestration script:**
  - Backend: `cd backend && node index.js` (or `npm run dev` for `node --watch`), port
    **5099** (set via `PORT` in `.env` — the code's own default is 5000, but this project's
    `.env` and the frontend's `VITE_API_BASE_URL` both point at 5099).
  - Frontend: `cd frontend && npm run dev` (Vite), port **5173**.
    `frontend/.env`: `VITE_API_BASE_URL=http://localhost:5099/api/v1`.
- **MongoDB — switched to Atlas, then reverted back to local, both on 2026-09-16.** `.env`'s
  `MONGO_URI` was pointed at a live Atlas cluster earlier the same day (at the user's
  request — see the dated note further down for that story), then the user edited `.env`
  directly (via their IDE) to switch it back to the local standalone `mongod`, commenting
  the Atlas lines out again. **As of the most recent check, local is what's active** — but
  this has flipped twice in one day, so treat `.env` itself as the only source of truth for
  which one is live right now, not this note.
  - **Local (currently active):** standalone `mongod` on the default port `27017`, database
    name `gst_billing_demo`. NOT a replica set — see convention #7 for the transaction
    implication (matters if this ever switches to Atlas again: transactions, used in
    `/auth/register` and invoice creation, silently need a replica set and fail without
    one). Verified live 2026-09-16: real company "Maruti Packaging" (GSTIN
    `24ACIFM5675P1ZG`, real bank details filled in via Company Profile at some point — this
    is NOT placeholder seed data), user "Ramesh Patel" (`demo@patelflexible.com`), 4
    products, 10 parties, 15 invoices, 3 masters, 1 e-way bill. This is the real working
    data — don't casually wipe or migrate away from it without the user's say-so.
  - **Atlas (currently inactive, commented out):** `marutiservices.e8uwix9.mongodb.net`,
    database `gst_billing`. Was completely empty as of 2026-09-16 (see the dated note) and
    nothing has been checked to have changed that since — no demo login exists there, and
    **No longer fully empty as of 2026-09-16** — see the dated note further down: the real
    Company document (and only that — no parties/products/invoices/masters) was migrated
    over from local, plus a real admin login created directly in the database. Is a proper
    Atlas replica set, so transactions work fine there (unlike local) if it's ever switched
    back to.
  - **Gotcha that actually bit this exact scenario: editing `.env` does NOT affect an
    already-running Node process.** `dotenv` reads the file once, at process startup;
    changing `.env` afterward has zero effect until the process is killed and restarted.
    The user switched `.env` back to local, but the backend that was still running (started
    hours earlier, when `.env` said Atlas) kept using its original in-memory Atlas
    connection — so the browser showed a normal-looking logged-in UI (a still-valid cached
    JWT from an old local session) while every real data lookup 404'd, because the *running
    server* was actually still talking to the empty Atlas database the whole time, not the
    local one `.env` currently named. Fixed by killing that process and restarting
    `node index.js` so it picked up the current `.env`. **Any time `.env` is edited —
    by anyone, IDE or otherwise — the backend needs an explicit restart before the change
    does anything**; nothing about the app itself will indicate this mismatch except
    confusing/inconsistent-looking failures exactly like this one.
- **Company (and only the company) migrated from local to Atlas, plus a real production
  login, both 2026-09-16.** The user explicitly wanted *just* the company record on
  production — no parties, products, invoices, masters, or e-way bills carried over (local
  has a mix of real records and accumulated QA-test artifacts from this week's testing;
  copying everything would have brought that test data into production too). Done as two
  direct MongoDB writes (throwaway scripts, deleted after running — not part of the
  codebase):
  1. Read the local `companies` document, stripped `_id`/timestamps, inserted as a fresh
     document into Atlas `gst_billing` (new `_id` `6aaa4ffe7a2da7c81b18a485` — nothing else
     in Atlas referenced the old local `_id`, so there was no reason to preserve it).
  2. Created a `users` document directly in Atlas, linked via `company` to that new
     document — `role: 'admin'`, password hashed with `bcrypt` at cost `12` (matching
     `auth.controller.js`'s own `BCRYPT_COST` exactly, so it behaves identically to a real
     `/auth/register` hash). **This was necessary, not optional** — the app has no "add a
     user to an existing company" flow, only `/auth/register`, which always creates a new
     company *and* user together as a pair; using that flow would have created a second,
     duplicate company rather than attaching a login to the one just inserted.
  - The company's local record still carried a leftover `purchaseTemplate` field from
    before Purchases was removed (2026-09-14) — dead, unused by any current code, not in
    the `Company` schema, but MongoDB doesn't enforce schema on fields already present in a
    raw document. Copied along as-is rather than silently dropped; harmless, but worth
    knowing it's there if anyone goes looking for why an "unknown" field exists on the
    Atlas company document.
  - **Verified live, through the real app, not just a database read**: spun up a *second*,
    temporary backend instance on port 5100 (env override, not touching the main dev
    server's `.env` or its already-running process on 5099) pointed at Atlas, logged in for
    real via `POST /auth/login` with the new credentials, got a valid access token, and
    confirmed `POST /companies/detail` returns the correct company data through that token.
    Killed the temporary instance afterward and confirmed the main local dev server (still
    serving local `gst_billing_demo`, untouched throughout) still logs in fine too.
  - Real credentials for this login are not written here — check with the user directly if
    you need them; this file is broadly readable context, not a secrets store.
- **Render free-plan keep-alive, added 2026-09-16 (prep work — app isn't deployed yet).**
  Render's free web-service plan auto-sleeps a service after ~15 minutes with no incoming
  requests, then cold-starts (slow) on the next one. The user asked for this to be handled
  proactively, before an actual deploy exists to test it against.
  - `GET /health` — new route, registered directly in `index.js` (not `router.js`), the
    **one deliberate exception** to this app's POST-only convention (see convention #1 in
    §2 and the route's own comment). Returns `{status: 'ok'}`, `200`, no auth, and
    deliberately doesn't touch the database — the point is confirming the Node process
    itself is alive, so a transient DB hiccup shouldn't make this report unhealthy.
    Verified live locally: `200`, correct body; confirmed it doesn't weaken the POST-only
    rule anywhere else (`GET /api/v1/invoices/list` still correctly `404`s).
  - `backend/render.yaml` — added `healthCheckPath: /health`, so Render's own platform
    health monitoring (a separate concern from the free-tier sleep behavior) uses the same
    route.
  - `.github/workflows/keep-alive.yml` — new scheduled GitHub Actions workflow, `cron:
    '*/14 * * * *'`, `curl`s `${{ vars.RENDER_APP_URL }}/health`. **Requires a one-time
    manual step once the backend is actually deployed**: add a repository variable named
    `RENDER_APP_URL` (Settings → Secrets and variables → Actions → Variables) set to the
    deployed backend's base URL, no trailing slash. Until that variable exists, every
    scheduled run just logs that it's unset and exits `0` — it doesn't fail the workflow or
    send requests anywhere, so it's safe to have merged before a deploy exists. Also has a
    `workflow_dispatch` trigger for a manual test run from the Actions tab once the variable
    is set. `*/14` doesn't divide 60 evenly (gap from :56 to the next hour's :00 is only 4
    minutes, not 14) — harmless, since the only real requirement is "never exceed Render's
    15-minute idle threshold," which this still guarantees; 14 rather than 15 was chosen
    specifically to leave margin for GitHub's own scheduler occasionally running a few
    minutes late under load.
  - **Logging, tightened up same day after the user asked whether it actually reports
    up/down clearly** — the first version just echoed a bare "OK" or a generic failure
    string, and *always* exited `0`, so a genuinely broken backend would still show as a
    green checkmark in the Actions tab forever. Now every run logs a timestamped line —
    `[2026-09-16T08:36:04Z] ALIVE — HTTP 200 in 0.10s — body: {"status":"ok"}` or `[...]
    DOWN or UNREACHABLE — HTTP <code> in <time>s` — and a genuine failure (bad status,
    timeout, DNS failure, connection refused — `curl`'s own outright failure is mapped to
    `HTTP 000` rather than left blank) makes the workflow step exit `1`, so the run itself
    shows red, and GitHub's own failed-scheduled-workflow email notification becomes real
    alerting, not just a log nobody reads. Verified the three paths directly with `bash`
    before touching the workflow file (not just eyeballing the YAML): a real local
    `/health` → `ALIVE`/exit 0; an intentionally unreachable port → `DOWN`/exit 1; empty
    `RENDER_APP_URL` → `SKIPPED`/exit 0.
  - **Backend actually deployed, 2026-09-16, live at `https://maruti-services.onrender.com`.**
    Confirmed via a real `curl` to `/health`: `HTTP 200`, body `{"status":"ok"}`. The
    keep-alive workflow's one-time manual setup step (add repo variable `RENDER_APP_URL` =
    this URL, no trailing slash) is **still not done** — `gh` CLI isn't available in this
    dev sandbox to set it directly, so it needs to be added by hand via Settings → Secrets
    and variables → Actions → Variables. Until then the workflow keeps logging `SKIPPED`
    every 14 minutes rather than actually pinging, so the free-tier sleep problem this was
    built to prevent is NOT yet actually prevented.
  - **`frontend/.env.production`, created by the user this same day, had a real bug**: set
    to `https://maruti-services.onrender.com` with no `/api/v1` suffix. Every other
    environment (local `frontend/.env`: `http://localhost:5099/api/v1`) includes it, and
    the backend mounts its whole router under `/api/v1` (`app.use('/api/v1', router)` in
    `backend/index.js`) — without the suffix every API call from a production build would
    404. Fixed to `https://maruti-services.onrender.com/api/v1`. Also gitignored correctly
    (the user's edit already added `.env.production` to `frontend/.gitignore`, mirroring
    what was just done for `backend/.env.production` above).
  - **Render's own startup logs show two `"level":"error"` 404s for `HEAD /` and `GET /`
    — this is expected, not a bug.** Render pings the root path as a generic "is anything
    listening on this port" check at deploy time, separate from `render.yaml`'s
    `healthCheckPath: /health` (which Render also checks, successfully). This app has no
    `GET /` route by design (POST-only convention, only `/health` and `/api/v1/*` exist),
    so `errorMiddleware` correctly 404s it — and this app's logger logs every 404 at
    `error` level, which is what makes an expected, harmless response look alarming in the
    Render log viewer. Don't mistake this for a real error when reading production logs.
  - **Frontend deployed too, 2026-09-16, live at `https://marutiservices-rho.vercel.app`**
    (Vercel). Confirmed via a real `curl` → `HTTP 200`.
  - **Real bug found live: refreshing (or directly navigating to) any deep route —
    `/invoices`, etc. — 404'd with Vercel's own "This page doesn't exist" page, not the
    app.** Root cause: the app uses `BrowserRouter` (`frontend/src/App.jsx`), which needs
    every path to be served `index.html` so React Router can take over client-side; without
    a rewrite rule, Vercel's static host looks for a literal file/route at `/invoices`,
    finds none, and 404s before React ever loads. Fixed by adding `frontend/vercel.json`:
    ```json
    { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
    ```
    This is the standard SPA-on-Vercel fix. **Requires a commit + push to take effect** —
    Vercel builds from git, so this file does nothing until it's deployed; not yet pushed
    as of this note (see whether the user wants it pushed now).
  - **Real production bug found live, 2026-09-16: "Download PDF" 500s on every invoice.**
    Reproduced directly via DevTools on the real deployed app (finalized `GST-0001` for
    Green Enterprise, then clicked Download PDF): `POST /invoices/pdf` → `500`, body
    `{"success": false, "message": "Something went wrong..."}`. Render's own server log
    (confirmed by the user, same incident) gave the precise error: `Could not find Chrome
    (ver. 127.0.6533.88)... your cache path is incorrectly configured (which is:
    /opt/render/.cache/puppeteer)`. Root cause, more precise than initially guessed: this
    isn't (only) a missing-system-library crash — for Render's native Node runtime, the
    build step and the running container can be separate environments, so the Chrome
    binary Puppeteer's `npm install` downloads into its cache during build doesn't
    necessarily survive into the container that actually serves requests. `runtime: docker`
    fixes both problems at once: the build (`RUN npm install`, which downloads Chrome) and
    the runtime share the exact same image layer, guaranteeing the binary persists, and the
    Dockerfile's installed system libraries (`libnss3`, `libgbm1`, etc.) cover the second,
    originally-assumed failure mode too. Fixed by switching
    `render.yaml`'s `runtime: node` to `runtime: docker` — `backend/Dockerfile` (already
    present, prepared for exactly this) installs the full Chromium dependency list and
    replaces `buildCommand`/`startCommand` with its own `RUN npm install` / `CMD ["node",
    "index.js"]`. Confirmed `puppeteer` is a real `dependencies` entry (not
    `devDependencies` — the Dockerfile's `npm install --omit=dev` would otherwise have
    skipped it). **Still needs to actually reach Render**: this only exists in the repo so
    far — needs a commit + push, and depending on whether Render's Blueprint auto-sync can
    switch an *existing* service's runtime in place, may also need the user to check
    Render's dashboard (Settings → Environment) or, if that option isn't offered for an
    existing service, delete and recreate the web service from the Blueprint so it picks up
    `runtime: docker` on creation. Not yet verified end-to-end post-fix — re-test "Download
    PDF" once redeployed.
  - **`backend/.env.production`'s `CLIENT_URL` had a real bug when the user first filled it
    in**: set to `https://marutiservices-rho.vercel.app/login` (with a path). `index.js`
    does `cors({ origin: env.clientUrl, ... })`, an exact-match check against the browser's
    `Origin` header, which never includes a path — so as written, every real request from
    the deployed frontend would have been silently rejected by CORS. Fixed to
    `https://marutiservices-rho.vercel.app` (origin only, no path, no trailing slash).
  - **`"Refresh token missing."` 401s in the Render logs are expected, not a bug** —
    verified live, not assumed. Logged in directly against the production API
    (`POST /api/v1/auth/login`, real credentials) and confirmed `Set-Cookie: ...; HttpOnly;
    Secure; SameSite=None` — exactly correct for the cross-site Vercel↔Render setup, meaning
    `NODE_ENV=production` is genuinely active on Render (`env.isProduction` gates this in
    `auth.controller.js`'s `setRefreshCookie`). The 401s themselves are
    `frontend/src/api/axiosClient.js`'s response interceptor silently probing
    `/auth/refresh` whenever any call gets a 401 (e.g. right after a page load, since the
    access token lives only in memory) — a logged-out visitor correctly gets this 401, and
    the interceptor already handles it gracefully (redirects to `/login`, suppresses the
    raw toast — see its own comment). Logged at `error` level only because this app logs
    every non-2xx response that way, same as the benign `Route not found: /` lines above.
    Expect to keep seeing this in the logs for any visit without an active session; it is
    not a sign of a request loop or misconfiguration.
  - **Confirmed live, 2026-09-16: Render's actual `CLIENT_URL` had a trailing slash, and
    that alone broke login with a real browser-visible CORS error** (`Login failed.` on the
    live site; DevTools showed the `login` XHR as `CORS error` even though the preflight
    `OPTIONS` returned `204`). Diagnosed by curling the live API directly with
    `Origin: https://marutiservices-rho.vercel.app` and reading the response:
    `access-control-allow-origin: https://marutiservices-rho.vercel.app/` — a trailing
    slash the browser's actual Origin header never has. Root cause: `index.js`'s
    `cors({ origin: env.clientUrl })` — when `origin` is a plain string, the `cors`
    package sets `Access-Control-Allow-Origin` to that exact string verbatim without even
    comparing it to the request's real Origin first, so the login call itself succeeded at
    the HTTP level (`200 OK`, correct body) while the browser silently blocked the response
    from reaching JS because the two strings weren't byte-for-byte identical. **This can
    only be fixed in Render's dashboard** (backend service → Environment → `CLIENT_URL`) —
    `render.yaml` marks it `sync: false`, meaning Render never reads it from this repo, so
    editing `backend/.env.production` alone (already trailing-slash-free) does nothing on
    its own. User still needs to update it there to `https://marutiservices-rho.vercel.app`
    (no trailing slash, no path) and let Render redeploy.
  - This is genuinely necessary prep, not premature optimization — Render's sleep behavior
    is triggered by incoming *traffic*, not by anything the app can do internally (a
    `setInterval` inside the Node process wouldn't help; if Render has already stopped the
    process for being idle, nothing inside that stopped process can run to wake it back up
    — only an external request can). An external scheduled pinger is the standard, correct
    fix for this specific problem, not a workaround for a workaround.
- **`backend/.env.production`, added 2026-09-16** — a real, ready-to-paste production
  environment file, at the user's explicit request ("directly copy paste"). Distinct from
  `backend/.env.example` (blank template, safe to commit): this one holds real values —
  the Atlas `MONGO_URI` already backing the migrated Company/login (see the company-only
  migration note above), and a freshly-generated `JWT_SECRET` deliberately different from
  local dev's (so a leaked secret in one environment can't forge tokens in the other).
  `CLIENT_URL` is deliberately left as an explicit `REPLACE_WITH_...` placeholder rather
  than a guess — no frontend has been deployed yet, and a wrong guess would silently break
  CORS once it is. **Gitignored explicitly**: `backend/.gitignore`'s bare `.env` pattern
  does NOT also match `.env.production` (different filename), so `.env.production` was
  added to `backend/.gitignore` as its own line before the file was written, and `git
  status` was checked afterward to confirm it doesn't appear as untracked. If using the
  Render Blueprint (`render.yaml`), most of these values are already hardcoded there or
  auto-generated (`JWT_SECRET`) — this file matters most for `MONGO_URI`/`CLIENT_URL`
  (both `sync: false` in `render.yaml`, i.e. Render expects them typed into its dashboard)
  or for setting up the Web Service manually instead of via the Blueprint.
- **Sandbox-specific gotcha: this dev environment blocks Node's raw DNS resolver.**
  `dns.resolve4()` / `dns.resolveSrv()` (the `c-ares`-based path Node's `dns.resolve*`
  family uses — raw UDP queries straight to a DNS server) fail with `ECONNREFUSED` for
  *any* hostname, confirmed even for `www.google.com` — this is not MongoDB-specific.
  `dns.lookup()` (the OS-integrated `getaddrinfo` path — what `curl`, `nslookup`, and
  Node's own `net`/`tls`/`http` modules use for normal outbound connections) works fine.
  Consequence: **`mongodb+srv://` connection strings fail here** (the driver's SRV/TXT
  record discovery uses the blocked path) even with correct credentials — the error
  (`querySrv ECONNREFUSED ...`) looks network-related, not auth-related, and is easy to
  misread as a wrong password or a firewalled cluster. **Fix:** use the standard
  `mongodb://` form with the actual shard hosts spelled out instead of a single SRV
  hostname — `nslookup -type=SRV _mongodb._tcp.<cluster-host>` (a plain shell command,
  unaffected by this) reveals the real shard hostnames to use. This is exactly what `.env`'s
  active `MONGO_URI` does now. **If this sandbox's networking ever changes and raw DNS
  stops being blocked, the commented-out `mongodb+srv://` line in `.env` is what a normal
  hosting environment (Render, etc.) should actually use** — the non-SRV workaround is a
  sandbox accommodation, not the preferred form in general.
- **`backend/.env` is not committed** (gitignored) and was, at one point, missing entirely
  from disk — its values had only ever existed in the environment of whatever terminal
  originally launched the process. If the backend process is ever killed without a `.env`
  file present, it cannot restart on its own (`config/env.js` fails fast on missing
  `MONGO_URI`/`JWT_SECRET`). **Keep a copy of a working `.env` somewhere safe outside the
  repo.** (JWT_SECRET can be regenerated freely — it only invalidates currently logged-in
  sessions, not any stored data.)
- ~~This project is not a git repository~~ — **became one on 2026-09-16**, at the user's
  request, specifically to unblock a Render deploy (Render needs a git remote to build
  from). `git init` at the project root (the repo covers both `backend/` and `frontend/` in
  one tree — Render's own "root directory" per-service setting is how a single repo still
  deploys the backend and frontend as separate services). Root commit `cedfbc5` on branch
  `master`, 135 files. Before committing, cleaned up a few stray dev artifacts that predated
  git and weren't caught by the existing `.gitignore`s: `backend/demo.pid`,
  `backend/test-classic-v2.pdf` (leftover from an earlier PDF-layout debugging session —
  see §8), `frontend/dev.pid` — all deleted; `*.log`/`*.pid` added to both `.gitignore`s so
  future dev-server log/pid files don't need the same manual cleanup. Verified before
  committing that no `.env` or other secret ever got staged (`git status --short | grep
  -iE '\.env$|\.pem$|\.key$'` came back empty) — both `.gitignore`s already had `.env`, so
  this was a sanity check, not a fix.
  **Push status:** pushed. The user provided the remote in a follow-up message —
  `https://github.com/marutiservices2026/Maruti_Services.git` — added as `origin`, and both
  commits are live on branch `master` there (confirmed via `git status`: "up to date with
  'origin/master'", clean working tree). Before that there was no git history at
  all, which is why this file and the code's own comments were built up as the record of
  "what changed and why" instead — that history predates git and isn't recoverable from
  `git log`; this file remains the authoritative record for anything before 2026-09-16, and
  normal commit history takes over from there for anything after.
- ~~Cloudinary is not configured locally~~ — **no longer applicable, Cloudinary was removed
  entirely 2026-09-15.** Logo/signature upload now stores a base64 data: URI directly on the
  Company document — no external account, no env vars, works identically in every
  environment. See the dated removal note further down for why.
- **No CI/CD wired up, and no actual Render/Vercel deploy has happened yet.** Deployment
  config files exist (`backend/render.yaml`, `backend/Dockerfile`, `backend/.dockerignore`,
  and now `.github/workflows/keep-alive.yml` — see §9's dated note) targeting Render for the
  backend — but the app has never actually been deployed there or to Vercel. A real MongoDB
  Atlas cluster with real credentials does exist and is reachable (see the dated note
  above) — but as of the most recent check, `.env` is pointed at local MongoDB again, not
  Atlas, so don't assume Atlas is the active connection without checking `.env` yourself
  first.

---

## 10. Testing / verification approach used on this project

There's no automated test suite (no Jest/Vitest/Playwright test files committed) — this
project has been verified throughout via **live browser automation** rather than unit tests:
the `browser-automation` skill (`node <skill-dir>/browser.mjs <url> --script <file>
--session <id>`) driving a real headless Chromium (Patchright) against the actual running
dev servers, asserting on real DOM state / real API responses / real screenshots, not mocks.
When picking this project back up, prefer that same approach for verifying a change actually
works over trusting code review alone — this has repeatedly caught real bugs (a Winston
logger silently dropping all output, a stale-focus bug breaking keyboard shortcuts, an
`<label>`/`<input>` id-association gap) that static reading missed. Always `--close` a
browser-automation session when done with it, or it keeps running until reboot.

**API-level negative testing** (2026-09-15): ran a 119-request sweep hitting every one of
the app's ~33 endpoints directly (plain `fetch`, not the browser UI — faster and more
precise for this kind of check) with missing fields, malformed/nonexistent ObjectIds,
NoSQL-injection-shaped payloads (`{"$gt": ""}` etc.), business-rule violations (negative
quantities, wrong master-type refs, financial-field edits on a finalized invoice), bad file
uploads, and auth edge cases. Result: **zero 500s**, every case returned a proper 4xx (or
legitimate 2xx) with the standard `{success, message}` shape, and the server process never
crashed or restarted across the whole run. Confirmed specifically: malformed ObjectIds
passed into unvalidated list-filter fields (`party`, `product`) correctly hit
`error.middleware.js`'s `CastError` branch (400) rather than crashing; the finalized-invoice
immutability guard (`FINANCIAL_FIELDS` check + the "cannot revert to draft" check) was
verified against the real `GST-0001` with a before/after diff proving nothing mutated. One
coverage gap, not a bug: there's no way to test `requireRole('admin')` actually rejecting a
non-admin, since `/auth/register` always creates an admin (by design) and there's no
user-management endpoint to create an accountant-role account otherwise.

---

## 11. Known, accepted local-only limitations (do not "fix" these without being asked)

- **MongoDB transactions fail locally (standalone mongod, not a replica set) — back in
  effect as of 2026-09-16's second `MONGO_URI` switch.** This briefly stopped being true
  for a few hours the same day while `MONGO_URI` pointed at Atlas (a real replica set), but
  the user switched it back to local before this file was last edited — check `.env` for
  which is actually active (§9 has the full back-and-forth) rather than trusting this line.
  Works fine again the moment `MONGO_URI` points at Atlas — see convention #7.
- ~~No git repository, so no commit history / blame to consult~~ — no longer true as of
  2026-09-16, see §9's dated note.
- No automated test suite — verification is manual/live (section 10).
- Deployment configs exist but have never actually been deployed anywhere.

---

## 12. How to keep this file updated

**Every time you (an AI model working on this repo) make a change, before ending your turn:**

1. Ask: does this change affect anything described above — a new file/folder, a new
   convention, a new dependency, a schema change, a new route, a new env var, a gotcha you
   had to work around, a limitation you discovered? If yes:
2. Update the relevant section directly (don't just append to the bottom — keep the
   document organized by topic, matching the existing section structure).
3. Update the "Last updated" date at the top.
4. If it's a big enough addition to deserve its own narrative (like section 7 above), add a
   new numbered section with a short "added <date>" note, and cross-reference it from
   section 2 if it establishes a new convention.
5. Keep entries **factual and specific** (file paths, exact behavior, exact gotcha) — this
   file is meant to replace re-reading the codebase, not to summarize vaguely. Prefer "why"
   over "what" wherever the reasoning isn't obvious from the code itself.
6. If something documented here turns out to be stale or wrong (a file moved, a convention
   changed, a limitation got resolved), correct it in place rather than leaving it — a wrong
   `understand.md` is worse than no `understand.md`.

This maintenance instruction is also mirrored in `CLAUDE.md` at the project root, which any
Claude Code session reads automatically at the start of every conversation in this project —
so it should not be possible to work on this repo via Claude Code without seeing it. If you
are a different AI tool without an equivalent auto-loaded instructions file, this section is
your only reminder — please still honor it.
