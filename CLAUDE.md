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

- Every backend API route is **POST-only** — see `understand.md` §2 before adding a route.
- Controllers never touch Mongoose models directly — always go through `backend/methods.js`
  (services are the exception). See `understand.md` §2 and §5.
- The keyboard-first UX system (`Alt+1..7`, `Space`, `Backspace`, `Ctrl+Enter`, `Alt+D/I`) is
  a deliberate, tested feature — don't remove or fight it. See `understand.md` §6.
- The `classic` PDF invoice template is visually pinned to a user-supplied reference image —
  don't restyle it without being asked. See `understand.md` §2.15 and §8.
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
- This is not a git repository, and there's no automated test suite — verification is done
  live via the `browser-automation` skill against the running dev servers. See
  `understand.md` §10.
