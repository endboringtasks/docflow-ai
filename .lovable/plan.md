# Portal Invitation Creation (DOC-35)

## Spec summary
As a team member, generate a client portal link so the client can upload documents remotely. The dialog should capture client email + expiration date, validate required fields, create a unique secure token, persist a `client_portal_access` record, and display the link with a copy option. Expired tokens are denied; valid tokens grant upload access.

## What already exists (no change needed)
The flow is largely implemented:

- `InviteClientDialog.tsx` opens from the application detail page, generates a unique token (`crypto.randomUUID()` x2), upserts a `client_portal_access` record, and shows the link with a copy button.
- `ClientPortal.tsx` validates the token via `validate_portal_access_token` RPC and denies invalid/expired links.

Coverage by AC:

```text
AC1 Generate link dialog ....... PARTIAL (no expiration date field)
AC2 Required-field validation ... PARTIAL (only email validated)
AC3 Unique secure token ......... DONE
AC4 client_portal_access record . DONE
AC5 Link displayed + copy ....... DONE
AC6 Expired token denied ........ DONE (validate_portal_access_token)
AC7 Valid token grants access ... DONE
```

## Gaps to close

### 1. Add an expiration date field (AC1)
In `InviteClientDialog.tsx`, add a date input (default 30 days out, the current hardcoded value). Use the selected date for `token_expires_at` instead of the hardcoded `+30 days`. Keep a sensible min (today/tomorrow).

### 2. Required-field validation (AC2)
Validate both client email (format + presence) and expiration date (present + in the future) before enabling/processing **Generate Link**. Show inline validation errors rather than only a toast.

### 3. Action label alignment (AC1)
Rename the trigger button on the application detail page from "Invite Client" to "Generate Client Portal Link" (the dialog primary button already reads "Generate Link"). Optional, for spec wording consistency.

## Out of scope
No database/schema changes — `client_portal_access` and the validation RPCs already exist and satisfy AC3–AC7.

## Verification
- Open the dialog: email + expiration date fields render; date defaults to +30 days.
- Submit empty / past date → inline validation errors; no record created.
- Submit valid → unique link shown with working copy button; `client_portal_access` row created with the chosen `token_expires_at`.
- Open the generated link in the portal → upload access granted; open an expired link → access denied.
