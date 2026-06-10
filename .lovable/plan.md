# DOC-53 — Webhook Secret Key Signing

## Decisions (from you)
- **Headers:** add `X-Docflow-Signature` + `X-Docflow-Timestamp`, AND keep sending `x-make-apikey` (backward compatible).
- **Signature naming:** `X-Docflow-Signature: sha256=<hex>` + `X-Docflow-Timestamp`.
- **Storage:** keep current model — `secret_key` stored as-is (RLS-protected, admin-only, masked after create). No encryption-at-rest change.

## What already exists (no work needed)
- Per-webhook `secret_key` generated on create, masked after, copy-once dialog, rotate action with audit log (DOC-50).
- Timing-safe comparison utility already lives at `supabase/functions/_shared/timing-safe-compare.ts` (BR-9/AC-4/TC-5).
- Delivery records every attempt to `webhook_request_logs` without exposing the secret (PF-2 step 5).
- A stable per-delivery `event_id` already acts as the delivery id (BR-12).

## Gaps this plan closes
```text
BR-5/BR-6/BR-7/BR-8/AC-2/TC-2   no HMAC signature or timestamp header is sent today
BR-14/AC-5                      signing errors must fail the delivery, not send unsigned
BR-10/UI-6                      no consumer verification snippet / header docs in the UI
```

## Changes

### 1. Sign deliveries — `supabase/functions/dispatch-webhook/index.ts`
- Add a `computeSignature(secret, timestamp, rawBody)` helper using Web Crypto `crypto.subtle` HMAC-SHA256 over the exact string `timestamp + '.' + rawBody`, returned as lowercase hex.
- In `sendWebhookWithRetry`:
  - Serialize the body **once** into `rawBody` (so the signed bytes are exactly the bytes sent).
  - When `webhook.secret_key` is present (BR-1): compute a single `X-Docflow-Timestamp` (unix seconds) and `X-Docflow-Signature: sha256=<hex>` for the delivery, reused across retries so the signature stays valid (pairs with the stable `x-idempotency-key`).
  - Keep `x-make-apikey: secret_key` as today.
  - Send `body: rawBody` instead of re-stringifying.
  - When no secret is set, send no signature/timestamp headers (AC-1/TC-1).
- **BR-14/AC-5:** if signature computation throws, do **not** fall back to an unsigned request — record a failed attempt (status 0/`final_state: "failed"`, error `signing_failed`) via the existing `onAttempt` logger and abort that delivery.
- **BR-4:** never log the secret or the signature value; existing logging already avoids the secret.

### 2. Admin UI guidance — `src/pages/admin/Webhooks.tsx`
- In the existing integration/docs callout (currently the `x-make-apikey` bullet), document the new headers:
  - `X-Docflow-Signature: sha256=<hex>` and `X-Docflow-Timestamp` (unix seconds).
  - Signature base string: `timestamp + "." + raw_request_body`.
- Add a copy-pasteable **verification snippet** (Node.js, language-agnostic logic) showing: read the two headers, recompute `HMAC_SHA256(secret, timestamp + "." + body)`, compare with `crypto.timingSafeEqual` (BR-9/BR-10/UI-6), and reject if the timestamp is outside ±5 minutes (BR-11).
- Keep the existing "store the secret securely" warning callout (UI-5) — already present in the copy-once dialog.

No DB migration, no new secret, and no signing toggle are required: signing is implicitly active whenever a secret exists (which it always does after create), matching BR-1 and the current secret lifecycle.

## Technical notes
- HMAC base string and hex encoding must match the documented snippet exactly so consumer verification succeeds (TC-2/TC-4).
- Signing the pre-serialized `rawBody` (not a re-stringified object) is essential — any difference in serialization would break verification.
- Timestamp/signature are computed per delivery and held constant across retry attempts.

## Verification
- Webhook **with** secret → delivery carries `X-Docflow-Signature` + `X-Docflow-Timestamp` (+ `x-make-apikey`); recompute HMAC over `timestamp.body` and confirm it matches (AC-2/TC-2).
- Tamper with the body → recomputed signature differs → verification fails (TC-4).
- Temporarily break signing → delivery is recorded as failed, nothing unsigned is sent (AC-5).
- Test via the per-row "Send test payload" button and inspect `webhook_request_logs` / a request-bin receiver.
