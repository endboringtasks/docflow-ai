# DOC-55 — Webhook Monitoring Dashboard

## Context
`src/pages/admin/WebhookMonitoring.tsx` already exists and is reachable at `/admin/webhook-monitoring`, protected by `AdminProtectedRoute` (satisfies BR-10 / PERM-1 / AC-1 / TC-2). It already shows KPI tiles (total/success/client errors/server errors/rate-limited/avg duration), 24h volume + response-time charts, an active rate-limits panel, and a request-log table with endpoint and status filters. Hourly stats come from `get_webhook_hourly_stats()` (BR-6 / AC-5 / TC-4).

This work closes the remaining DOC-55 gaps. It is **frontend-only** — no schema or RPC changes.

## Gaps to close
```text
UI-5 / PF-2     no time-range filter on logs/metrics
UI-6            request log capped at 100 rows, no pagination
UI-7 / TC-5     failed rows show error text but no detail view
BR-13           no error state / retry if stats or logs fail to load
```

## Changes — `src/pages/admin/WebhookMonitoring.tsx`

### 1. Time-range filter (UI-5, PF-2, BR-5)
- Add a `timeRange` state with a `Select`: **Last 1 hour**, **Last 24 hours** (default), **Last 7 days**, **Last 30 days**.
- Map each option to a cutoff via `date-fns` (`subHours` / `subDays`) and apply `.gte("created_at", cutoff)` to the logs query.
- Add `timeRange` to the logs query key so it refetches on change.
- Summary KPI tiles already derive from the loaded `logs`, so they automatically reflect the selected window (BR-5 / AC-3).

### 2. Paginated request log (UI-6)
- Replace the fixed `.limit(100)` with page-based loading: `pageSize = 50`, `.range(0, page*pageSize - 1)`.
- Add a **Load more** button below the table, shown while the last fetch returned a full page. Clicking increments `page`.
- Reset `page` to 1 whenever any filter (endpoint / status / time range / search) changes.

### 3. Expandable failed-row error details (UI-7, TC-5)
- Make failed rows (status >= 400, has `error_message`, or `final_state === "failed"`) clickable to toggle an expanded detail row beneath them (chevron indicator).
- The expanded row spans full width and shows: error message, status code, timestamp (absolute), duration, attempt number (`attempt_number`), outcome/`final_state`, and `will_retry`. Non-sensitive fields only (PERM-2 — no payload bodies/secrets).
- Track expansion with an `expandedId` state; only failed rows are interactive.

### 4. Stats/log error + retry state (BR-13)
- Surface `isError` from the hourly-stats and logs queries.
- When stats fail: replace the two charts with an inline error card ("Couldn't load webhook stats") plus a **Retry** button calling the query's `refetch`.
- When logs fail: show an error row in the table area with a **Retry** button.

## Out of scope (per spec)
Webhook config (DOC-50), retry policy (DOC-54), payload selection (DOC-52), external alerting, and log retention jobs (BR-12 is an ops policy, not UI).

## Verification
- Switch time ranges → KPI tiles and log table update to the window.
- Load more → additional rows append; button hides when exhausted.
- Click a failed row → inline details expand with error/status/duration/attempt.
- Filter "Rate Limited" → only `rate_limited = true` rows shown (TC-3).
- Temporarily break the stats query → error card with working Retry (BR-13).
