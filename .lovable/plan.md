# Fix: Second webhook missing from the endpoint filter

## Problem
The "All Endpoints" dropdown on the Webhook Monitoring page only lists `dispatch-webhook` and the **Application** (`lcr8...`) URL. The **Client** (`zn1o...`) webhook is missing, even though it has 322 logged requests and is active.

## Root cause
In `src/pages/admin/WebhookMonitoring.tsx`, the dropdown options come from this query:

```ts
.from("webhook_request_logs")
.select("endpoint")
.order("endpoint", { ascending: true })
.limit(1000)
```

then dedupes the endpoints in JS. With ~1,352 log rows ordered alphabetically, the first 1,000 rows are entirely `dispatch-webhook` (660) + the Application URL (370). The Client URL rows fall beyond row 1,000 and are never fetched, so that endpoint never shows up. This is a client-side dedupe on a truncated, non-distinct result set.

## Fix
Get a true DISTINCT list of endpoints from the database instead of deduping a capped row fetch.

Add a security-definer RPC that returns distinct endpoints:

```sql
create or replace function public.get_webhook_log_endpoints()
returns table (endpoint text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct endpoint
  from public.webhook_request_logs
  where endpoint is not null
  order by endpoint
$$;

grant execute on function public.get_webhook_log_endpoints() to authenticated;
```

Then update the `webhook-endpoints` query in `WebhookMonitoring.tsx` to call this RPC:

```ts
const { data } = await supabase.rpc("get_webhook_log_endpoints");
return (data ?? []).map((d) => d.endpoint).filter(Boolean);
```

Remove the old `.select/.order/.limit(1000)` + `Set` dedupe logic.

## Verify
- Open the endpoint dropdown — it should now list `All Endpoints`, `dispatch-webhook`, and **both** Make.com URLs.
- Select the Client (`zn1o...`) URL and confirm matching logs load.

## Note
The dropdown shows raw endpoint strings (`dispatch-webhook`, long Make URLs). If you'd prefer friendly labels like "Application" / "Client" (joined from `platform_webhooks`), I can add that as a follow-up — say the word.
