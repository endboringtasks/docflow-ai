## Context

The BDD spec "Portal Submission" (Jira DOC-40) is almost entirely implemented already. I verified each Business Rule and Acceptance Criterion against the current code:

| Spec | Status | Where |
|---|---|---|
| BR-1 / AC-1 / AC-2 — Submit only when required docs uploaded | ✅ | `ClientPortal.tsx` `isEligibleToSubmit`, `missingRequiredDocs` |
| BR-2 / AC-7 / TC-4 — One-time, idempotent | ✅ | `submit_portal_access` RPC (`WHERE is_submitted = false`) |
| BR-3 / AC-4 — Sets `is_submitted` + `submitted_at` | ✅ | RPC + `client-portal-submit` edge fn |
| BR-4 / AC-5 / TC-5 — Read-only after submit (client + server) | ✅ | UI guards + `client-portal-upload`, `portal-request-upload-url`, `portal-finalize-upload`, `client-portal-remove-document` all reject when `is_submitted` |
| BR-5 / AC-6 / TC-7 — Notify company members | ✅ | `client-portal-submit` inserts notifications |
| UI-2 / AC-3 / TC-3 — Irreversible confirm dialog + cancel | ✅ | `isSubmitDialogOpen` AlertDialog |
| UI-3 / TC-6 — Post-submission "Submitted" state | ✅ | Submitted card with `submitted_at` |
| UI-4 / TC-8 — Failure keeps portal editable | ✅ | `handleSubmit` catch block |

## The one gap

**AC-2 / TC-2** require the UI to show *which* required document(s) are missing (an actionable list). Today the portal only shows a **count** ("3 required documents still needed") and a generic tooltip — not the names.

## Change (frontend only)

In `src/pages/client-portal/ClientPortal.tsx`, replace the count-only message (lines ~1536–1540) with an actionable list of the missing required document names, derived from the existing `missingRequiredDocs` array (using the same name-cleanup regex already used elsewhere in the file). Keep it compact and enterprise-styled (no inline buttons), e.g. a short heading plus a bulleted list of the cleaned document names. The Submit button disabled state and tooltip remain unchanged.

No backend, schema, or edge-function changes are needed — those acceptance criteria are already satisfied.

## Verification

- Open a portal missing one or more required docs → the named list of missing documents is shown and Submit stays disabled.
- Upload all required docs → list disappears, Submit enables.
- Confirm submitted portals still render the read-only "Submitted" state.

## Files

- `src/pages/client-portal/ClientPortal.tsx`
