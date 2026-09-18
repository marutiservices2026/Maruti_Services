# Project instructions

Before doing anything else in this repo, read **`understand.md`** at the project root. It is
the maintained knowledge base for this project — architecture, conventions, data model,
folder structure, known gotchas and limitations, local dev setup, and the reasoning behind
non-obvious decisions. It exists so no session has to re-derive this from scratch.

## Mandatory: keep `understand.md` up to date

**Whenever you make a change to this project — code, schema, config, a new dependency, a new
convention, a deployment change, a bug fix that reveals a non-obvious gotcha — update the
relevant section of `understand.md` in the same turn**, before ending your response. Do not
defer it, and do not treat it as optional documentation work. An out-of-date `understand.md`
should be treated as a bug in the change itself.

Update the existing section that covers the area you touched rather than just appending to
the bottom. If the change is substantial enough to be its own topic, add a new numbered
section following the existing structure and note the date. Full protocol is in
`understand.md`'s own final section ("How to keep this file updated") — follow it exactly.

## A few conventions worth knowing before you touch anything

- Every backend API route is **POST-only, with exactly one exception: `GET /health`**
  (added 2026-09-16, for Render's own health monitoring and a keep-alive pinger — see
  `understand.md` §2 and §9). Don't add another GET/PUT/PATCH/DELETE route without being
  explicitly asked.
- Controllers never touch Mongoose models directly — always go through `backend/methods.js`
  (services are the exception). See `understand.md` §2 and §5.
- The keyboard-first UX system (`Alt+1..7`, `Space`, `Backspace`, `Ctrl+Enter`, `Alt+D/I`) is
  a deliberate, tested feature — don't remove or fight it. See `understand.md` §6.
- The `classic` PDF invoice template is visually pinned to a user-supplied reference image —
  don't restyle it without being asked. See `understand.md` §2.15 and §8.
- **Quotations, shown to the user as "Separate Bills" (added 2026-09-17, renamed same
  day), are deliberately separate from Invoices** — own model (`Quotation`, internal naming
  unchanged by the rename), own controller, own nav item, own numbering series (printed as
  `SB-####`), structurally excluded from every sales/GST report. Never a tax invoice that's
  merely hidden from tracking — a real request for that was declined outright (see
  `understand.md` §12's opening note for why) in favor of this honest version. "Convert to
  Invoice" is the one place it becomes a real, tracked sale. Search "quotation" (lowercase)
  for the code, "Separate Bill" for what the user sees — same feature, two names. See
  `understand.md` §12.
- **This app is sales-only — Purchases was fully removed on 2026-09-14.** Don't reintroduce
  a `PurchaseBill` model, `/purchases/*` routes, or purchase pages/components without being
  explicitly asked; if you see a stray "purchase" reference the codebase-wide search missed,
  clean it up. See `understand.md` §1.
- **The custom-fields system (FieldConfig/"Manage Fields") and logo/signature upload were
  both removed entirely on 2026-09-15** — a real-usage audit found zero FieldConfig
  documents ever existed, and the bundled default logo already IS this company's own logo,
  so uploading a different one was solving an already-solved problem. PDFs always use the
  bundled default logo now; there is no signature image on invoices at all. Don't
  reintroduce either (or Cloudinary, which the upload feature briefly used before being
  removed outright) without being explicitly asked. See `understand.md` §6.
- **This became a git repository on 2026-09-16** (root commit `cedfbc5`, branch `master`) —
  before that there was no git history at all, and older notes in `understand.md` referring
  to "no git repository" describe that earlier state, not the current one. There's still no
  automated test suite — verification is done live via the `browser-automation` skill
  against the running dev servers. See `understand.md` §10.
