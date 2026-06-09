# DOC-40 — Portal Submission

The client portal already has a basic submit flow (`submit_portal_access` RPC, `client-portal-submit` edge function for notifications, and a "Submitted" state). DOC-40 requires hardening it against the business rules and acceptance criteria. This plan closes the gaps without rebuilding what works.

## Gaps vs. spec

| Area | Current | DOC-40 requires |
|------|---------|-----------------|
| Submit eligibility (BR-1, AC-2, TC-2) | Enabled when ≥1 required doc uploaded | Enabled only when **all** required docs uploaded; otherwise blocked with an actionable list of what's missing |
| Confirmation (UI-2, AC-3) | "won't be able to make changes" | Clear **irreversible / one-time** wording |
| Idempotency (BR-6, AC-7, TC-4) | RPC is idempotent but UI shows a generic "Failed to submit" if already submitted | Gracefully report "already submitted", refresh to read-only state |
| Read-only after submit (BR-4, AC-5, TC-5) | UI hides editing when submitted; server already rejects uploads | Keep + verify; no change needed beyond confirmation |
| Notifications (BR-5, AC-6, TC-7) | Notifies all company members | Keep all-members behavior (recipient config out of scope) |

## Changes

### 1. Eligibility & missing-requirements (frontend)
In `src/pages/client-portal/ClientPortal.tsx`:
- Compute `missingRequiredDocs` = required, applicable docs that are not completed (or are `pending_client` / `rejected`).
- `isEligible = totalDocs > 0 && missingRequiredDocs.length === 0`.
- Change the Submit button to be disabled when `!isEligible`, with a tooltip/help text "Upload all required documents to submit".
- In the confirmation dialog, when not eligible, list the specific missing document names instead of allowing submit. (Button already opens dialog only on click; we gate the action.)

### 2. Irreversible confirmation copy (frontend)
Update the AlertDialog wording to clearly state submission is **one-time and irreversible** and that the portal becomes read-only afterward.

### 3. Idempotent / graceful submit (frontend)
In `handleSubmit`:
- If `submit_portal_access` returns `false` (already submitted) rather than throwing a generic error, treat it as success-path: set local `is_submitted = true`, close dialog, show an info toast "This portal was already submitted."
- Keep real errors (network/server) as failures that leave the portal editable (UI-4, TC-8).
- Disable the confirm button while submitting to prevent double-clicks (already present) and guard re-entry.

### 4. Success feedback (UI-5)
Keep success toast; the "Application Submitted!" card with `submitted_at` already satisfies post-submission state (UI-3, TC-6).

### 5. Server-side safety verification (no code change expected)
Confirm `portal-request-upload-url`, `portal-finalize-upload`, and `client-portal-remove-document` already reject when `is_submitted` is true (they check `portalAccess.is_submitted`). This satisfies TC-5 server enforcement. No migration needed — `submit_portal_access` already sets `is_submitted` + `submitted_at` atomically with an `is_submitted = false` guard (idempotent).

## Out of scope
- Configurable notification recipients (BR-5 note): current behavior notifies all company members; left as-is.
- No database migration required; existing RPCs and edge functions cover state, timestamp, idempotency, and notifications.

## Technical notes
- All edits are confined to `src/pages/client-portal/ClientPortal.tsx`.
- `missingRequiredDocs` reuses the existing `requiredDocuments` / review-status filtering already in the file.
- Idempotency relies on the existing `submit_portal_access` WHERE `is_submitted = false` clause returning `NULL`/`false` on repeat calls.
