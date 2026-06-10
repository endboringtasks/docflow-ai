# DOC-54 — Webhook Retry Configuration

## Audit: what already exists

The webhook delivery pipeline (`dispatch-webhook` edge function) and admin UI (`Webhooks.tsx`, `WebhookMonitoring.tsx`) already cover most of the spec:

- BR-1/BR-2: each webhook row has `max_retries` (default 3), `retry_backoff_seconds` (default 5), `timeout_seconds`.
- BR-4/BR-7/BR-8/BR-9: exponential backoff (`base * 2^(n-1)`), automatic retries up to `max_retries`, stops on first 2xx.
- BR-5/BR-6: non-2xx / network errors treated as failure (4xx except 429 treated as non-retryable), 2xx = success.
- BR-14: bounded — UI caps `max_retries` at 10.
- UI-1/UI-2/UI-3: config fields with ranges + Save/Cancel.
- UI-4/UI-5: `WebhookMonitoring` shows a delivery log with endpoint + status + time-range/status filters.

## Gaps to close

```text
BR-3 / AC-4 / TC-3  timeout is configurable but NEVER enforced during delivery
BR-10               payload has no idempotency key / event id for de-duplication
BR-12               only ONE final log row per webhook; individual attempts (attempt #,
                    will-retry flag) are not recorded
BR-13               no explicit final-state value (delivered / failed / disabled)
BR-4 (optional)     no max backoff cap (UI-1 lists it as optional)
```

## Changes

### 1. DB migration
Add to `public.platform_webhooks`:
- `delivery_timeout_seconds int not null default 30` — per-attempt request timeout (kept separate from the existing `timeout_seconds`, which drives folder-creation timeout and must not change meaning).
- `max_backoff_seconds int` (nullable) — optional cap on exponential delay.

Add to `public.webhook_request_logs` (all nullable, backward compatible):
- `attempt_number int`
- `will_retry boolean`
- `final_state text` — one of `delivered`, `failed`, `disabled`.

No new tables, so no new GRANT blocks required; existing grants/policies on these tables stay intact.

### 2. `dispatch-webhook` edge function
- **Timeout enforcement (BR-3/AC-4/TC-3):** wrap each `fetch` in an `AbortController` with `setTimeout(delivery_timeout_seconds * 1000)`. On abort, treat as a failed attempt (retryable) and clear the timer in a `finally`.
- **Idempotency (BR-10):** generate one stable `event_id` (UUID) per delivery (per webhook, constant across its retries). Include it in the JSON body (`event_id`) and as header `x-idempotency-key`. Add the existing secret already present.
- **Per-attempt logging (BR-12):** inside `sendWebhookWithRetry`, after every attempt write a `webhook_request_logs` row with `attempt_number`, `duration_ms` for that attempt, `status_code`/`error_message`, and `will_retry` (true when it failed and attempts remain). Replace the current single post-hoc log so each attempt is visible.
- **Final state (BR-13):** write a terminal log row / set `final_state` = `delivered` on 2xx, `failed` when retries exhausted; skipped inactive webhooks already aren't dispatched (covered by the `is_active` filter).
- **Backoff cap (BR-4):** when `max_backoff_seconds` is set, clamp the computed delay with `Math.min(delay, cap)`.
- Pass `delivery_timeout_seconds` and `max_backoff_seconds` from the webhook row into `sendWebhookWithRetry`.

### 3. Admin UI — `Webhooks.tsx`
- Add form fields to the create/edit dialog: **Delivery Timeout (seconds)** (e.g. 1–120, default 30) and **Max Backoff Cap (seconds)** (optional). Wire into `newWebhook` state, `createWebhook`, `updateWebhook`, `openEditDialog`, `openDuplicateDialog`, `resetForm`.
- Relabel the existing `timeout_seconds` field to clarify it is the folder-creation timeout (avoids confusion with the new per-attempt timeout).

### 4. Admin UI — `WebhookMonitoring.tsx`
- Surface the new columns in the delivery log table: **Attempt** (`attempt_number`) and **Final state** (`final_state` badge), plus a “retry in progress” style indicator when `will_retry` is true (UI-6).
- Extend the `WebhookLog` interface with the three new fields.

## Verification
- TC-1: defaults → consumer 500 → 4 total attempt log rows, `final_state=failed`.
- TC-2: `max_retries=1` → 2 attempt rows, `final_state=failed`.
- TC-3: unresponsive consumer + `delivery_timeout_seconds=2` → attempt aborts ~2s, retry scheduled.
- TC-4: fail then 200 → attempt 1 failed row, attempt 2 `delivered`, no further rows.
- TC-5: base 1s, repeated failures → delay increases (1s, 2s, 4s…) capped by `max_backoff_seconds` when set.

## Technical notes
- Adding `delivery_timeout_seconds` rather than reusing `timeout_seconds` avoids breaking the separate `timeout-folder-creation` flow.
- All new log columns are nullable so historical rows and other writers (`safeLogWebhookRequest` callers) keep working.
- Edge function deploys automatically; no secret changes needed (`x-webhook-secret` already supported).
