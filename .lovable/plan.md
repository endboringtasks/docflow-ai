# Allow multiple active portal links — one per applicant

## Problem
Today the invite dialog always reuses a **single** `client_portal_access` row per application (it looks up an existing row by `visa_application_id` + the application's primary `client_id` and updates it). Because every generation overwrites the same row:
- You can never have more than one usable link at a time.
- "Revoking one revokes all" — there is only ever one shared row, so revoking it kills the only token.

We will move to **one row per applicant**, so the Principal Applicant, Partner, etc. each get their own independent, individually-revocable link, while still preventing more than one *active* link per applicant.

## Solution overview
- Track which applicant a link belongs to (new `application_applicant_id` column).
- Generation creates a **new** row per applicant instead of overwriting; let the user pick the applicant from a dropdown.
- Block creating a new link for an applicant that already has an active link (must revoke first).
- Revoke already works per-row, so revoking one link no longer affects others.

## Changes

### 1. Database migration
- Add nullable column `application_applicant_id uuid` to `client_portal_access` (references the `application_applicants` row the link is for). Existing rows keep `NULL` (treated as the primary/legacy link).
- No RLS/grant changes needed (company-member policies already cover the table). Portal RPCs are unchanged — they resolve a single row by token.

### 2. `InviteClientDialog.tsx`
- New prop: `applicants` — list of `{ id, displayName, applicantType, email }` for the application.
- Add an **Applicant** dropdown (shadcn `Select`) at the top. Selecting an applicant pre-fills the email field (editable).
- In `generateAccessLink`:
  - Require an applicant to be selected.
  - **Pre-check active link:** query `client_portal_access` for a row with this `application_applicant_id`, `status = 'active'`, and `token_expires_at > now()`. If one exists, stop and show a message: "An active link already exists for this applicant. Revoke it before creating a new one." (formal/enterprise tone per project conventions).
  - Otherwise **always INSERT a new row** with `visa_application_id`, `client_id` (primary client, for RPC joins), `application_applicant_id`, `company_id`, `email`, `access_token`, `token_expires_at`. Remove the find-existing-and-update (upsert) branch entirely.
- Reset the selected applicant on close.

### 3. `PortalAccessSection.tsx`
- Include `application_applicant_id` in the select query.
- New prop: `applicants` map so each row can show the applicant label (e.g. "Principal Applicant — name") next to the email. Rows with `NULL` applicant id show just the email (legacy).
- No revoke-logic change needed — revoke already targets a single `id`, so it only affects that one link.

### 4. `ApplicationDetail.tsx`
- Build the applicants list from the existing `applicationApplicants` query (`id`, `displayName`, `applicant_type`, plus best-available email).
- Pass `applicants` to both `PortalAccessSection` and `InviteClientDialog`.
- Keep the existing cache invalidation on dialog close.

## Verification
- Generate a link for the Principal Applicant, then for the Partner → two active rows, two working links.
- Revoke the Principal's link → Partner's link still works; portal for revoked token shows access denied.
- Try generating a second link for the Partner while one is active → blocked with the "revoke first" message.
- Re-generate after revoking the Partner → succeeds (new active row).

## Notes
- Portal client-name display for related applicants (Partner) is out of scope here; the portal continues to resolve the application via the token. This change is about link lifecycle, not portal content.
