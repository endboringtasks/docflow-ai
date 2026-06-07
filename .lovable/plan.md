## DOC-35 — Generate Client Portal Link

### Context
Most of this story is already implemented:
- `InviteClientDialog.tsx` opens from the application detail page, generates a unique token, creates/updates a `client_portal_access` record linked to the application, and displays the link with a copy button (AC1 partial, AC3, AC4, AC5).
- `ClientPortal.tsx` validates the token via the `validate_portal_access_token` RPC, which only returns rows where `token_expires_at > now()`, so expired links are denied and valid links grant access (AC6, AC7) — no change needed.

### The gap
The dialog hardcodes expiry to 30 days. The spec requires the user to **enter an expiration date** that is **mandatory** and **today or in the future**, plus proper validation errors (AC1, AC2, and the related business rules). This is the only missing piece.

### Changes (frontend only)

**`src/components/visa-application/InviteClientDialog.tsx`**
1. Add an `expiresAt` state plus an `errors` state object.
2. Add an "Expiration Date" field using the existing `<input type="date">` pattern (as in `AddRelatedApplicantDialog`), with `min` set to today's date so past dates can't be picked. Label it as required.
3. Replace the single `toast.error` with inline field validation in `generateAccessLink`:
   - Email: required + basic email format → show error under the field.
   - Expiration date: required, and must be today or a future date → show error under the field.
   - If any error, set `errors` and return without generating.
4. Use the chosen date (end-of-day) for `token_expires_at` instead of the hardcoded +30 days.
5. Update the success display label from "expires in 30 days" to show the actual selected expiry date.
6. Reset the new state in `handleClose`.

### Verification
- Open the dialog from the application detail page, leave fields blank, click Generate Link → inline validation errors appear; no record created.
- Confirm a past date cannot be selected/submitted.
- Enter a valid email + future date → unique token generated, `client_portal_access` row created/updated with the chosen `token_expires_at`, link shown with copy button.
- Open the generated link in the portal → access granted; an expired record is denied (already covered by the RPC).

### Notes
No database, RLS, or edge-function changes are required — the schema (`client_portal_access` with `access_token`, `token_expires_at`, `is_submitted`) and access validation already support this story.
