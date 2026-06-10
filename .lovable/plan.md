# DOC-50 — Webhook Configuration

## What already exists (no work needed)

The webhook admin already covers most of DOC-50:

- **CRUD + enable/disable** — create/edit/duplicate/delete and an `is_active` toggle (UI-1/2/3, PF-1/2/3, AC-2, BR-1 partial).
- **Event subscription** — topic-grouped multi-select of supported event types only (UI-5, BR-3/BR-4).
- **Secret generation** — a `secret_key` is generated on create and stored on `platform_webhooks`.
- **Delivery** — `dispatch-webhook` selects enabled subscribed endpoints, POSTs JSON, retries, and records every attempt to `webhook_request_logs` with status/duration/error (PF-4, BR-8/9/10/13, AC-4/5, TC-3/5). The monitoring page surfaces these logs (UI-8).
- **Test delivery** — per-row "Send test payload" button (UI-9, TC-1).
- **Access control** — page sits behind the platform-admin route guard (PERM-1, AC-1).

## Gaps this plan closes

```text
BR-2 / AC-3 / TC-2   no HTTPS URL validation; any non-empty string saves
BR-5 / BR-6 / BR-7   secret never shown after create; no copy-once; no rotation
UI-6 / PERM-2        delivery sends raw secret in a non-standard header
BR-14                duplicate endpoints saved silently
```

## Decisions (from you)

- **Signing/auth header:** deliveries send the secret via the `x-make-apikey` HTTP header (Make.com's standard API-key header).
- **Secret lifecycle:** show + copy the secret once at create time, mask it afterwards, and add a **Rotate secret** action.
- **Duplicates:** show a non-blocking warning when an identical URL + event set already exists, but still allow saving.

## Changes

### 1. HTTPS URL validation — `src/pages/admin/Webhooks.tsx`
- Add a `validateUrl(url)` helper: must parse as a URL and use the `https:` protocol.
- Show an inline error under the URL field and disable Save when invalid (BR-2/BR-15/AC-3/TC-2).

### 2. Secret lifecycle UI — `src/pages/admin/Webhooks.tsx`
- **On create:** after insert, open a "Webhook created" dialog that displays the full `secret_key` once with a Copy button and a clear "you won't be able to see this again" note (PF-1 step 8, UI-6, BR-6).
- **List/edit:** never render the full secret again — show a masked placeholder (e.g. `••••••••last4`).
- **Rotate secret:** add a row action (and/or a button in the edit dialog) that generates a new `crypto.randomUUID()`, updates `secret_key`, and shows the new value once in the same copy-once dialog. Confirm via an `AlertDialog` first since old consumers will break (BR-7, PERM-2).
- Writes a `platform_audit_logs` row on rotation (`action: 'webhook.secret_rotated'`).

### 3. Duplicate warning — `src/pages/admin/Webhooks.tsx`
- Before create/update, compare the normalized URL + sorted event set against existing webhooks (excluding the one being edited). If a match exists, show a non-blocking inline warning callout; saving stays enabled (BR-14).

### 4. Delivery header — `supabase/functions/dispatch-webhook/index.ts`
- Replace the `x-webhook-secret` header with `x-make-apikey` carrying `webhook.secret_key` (keeps the existing plaintext-key model the user chose; no HMAC). Redeploys automatically.

## Out of scope (per spec)

Rate limiting / retry policy (DOC-54, DOC-56), payload field selection (DOC-52 — already built), advanced transformations. No DB schema change is required; `secret_key`, `webhook_request_logs`, and `platform_audit_logs` already exist.

## Verification

- Enter `http://…` → inline error, Save disabled (AC-3/TC-2). Enter `https://…` → saves.
- Create webhook → secret shown once with copy; reopen edit → secret masked.
- Rotate → confirm dialog → new secret shown once; audit row written.
- Save a second webhook with the same URL + events → warning shown, save still allowed.
- Trigger/test a delivery → outbound request carries `x-make-apikey`; attempt recorded in monitoring logs.
