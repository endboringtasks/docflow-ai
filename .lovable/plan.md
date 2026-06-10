# Fix: endpoint filter returns no logs

## Problem
The endpoint `Select` in `src/pages/admin/WebhookMonitoring.tsx` uses a hardcoded list:
`webhook-visa-application-folder`, `webhook-client-folder`, `webhook-automation-event`.

None of these match the `endpoint` values actually stored in `webhook_request_logs`, which are:
- `dispatch-webhook`
- `https://hook.eu2.make.com/...` (Make.com delivery URLs)

So any endpoint selection filters to zero rows → "No webhook requests recorded yet".

## Fix — `src/pages/admin/WebhookMonitoring.tsx`
- Replace the hardcoded `endpoints` array with a dynamic list derived from real data.
- Add a small query that selects `DISTINCT endpoint` from `webhook_request_logs` (e.g. a `webhook-endpoints` react-query keyed query, ordered by endpoint), and build the dropdown from `["all", ...distinctEndpoints]`.
- Keep the "All Endpoints" option (value `all`) as the default.
- For long Make.com URL values, render a truncated/title-tooltip label in the `SelectItem` so the dropdown stays readable, while the underlying value remains the exact stored endpoint string used for the `.eq("endpoint", ...)` filter.

## Verification
- Open the dashboard → endpoint dropdown lists `dispatch-webhook` and the actual Make.com hook URLs.
- Select `dispatch-webhook` → matching logs appear.
- Select an endpoint with no rows in the window → empty state still shows correctly.
