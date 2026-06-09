# Fix Missing Submission Notifications

## Root Cause
The client portal submit flow has a contract mismatch:

- The frontend (`ClientPortal.tsx`, line ~757) calls the `client-portal-submit` edge function with **only** `{ token }` in the body.
- The `client-portal-submit` edge function still expects `portal_access_id`, `visa_application_id`, `client_id`, and `company_id`. With none of them present, it returns `400 Missing required fields` and exits **before** creating any notifications.
- The `is_submitted = true` flag is set by a separate RPC (`submit_portal_access`), so the submission itself succeeds — but the notification step silently fails.

Verified against the database: the latest portal access (token ending `...d749a403...`) is `is_submitted = true`, the owning company has 1 member (an owner), and the `notifications` table is completely empty.

## Fix
Update `supabase/functions/client-portal-submit/index.ts` to resolve the submission from the `token` (matching what the frontend now sends), then create notifications.

Specifically:
1. Read `token` from the request body (keep backward-compat: still accept the old explicit fields if present).
2. Look up the `client_portal_access` row by `access_token = token` to derive `portal_access_id`, `visa_application_id`, `client_id`, and `company_id`.
3. Keep the existing enrichment (visa application name, client name) and the existing logic that inserts one `notifications` row per `company_members` user.
4. Return 400 only if neither a valid `token` nor the legacy fields can resolve a portal access record.

No frontend changes required — the frontend already sends `{ token }` and treats the call as best-effort.

## Result
- Submitting from the client portal creates a `client_submission` notification for every company member.
- The `NotificationBell` (now rendered in the header) shows the unread badge and links to the application.

## Technical Notes
- The edge function uses the service-role client, so RLS does not block the insert; the `notifications` schema already matches the inserted fields (`user_id`, `company_id`, `type`, `title`, `message`, `metadata`).
- This is purely an edge-function change; no migration is needed.
- Optionally, a one-off backfill notification could be inserted for the already-submitted application, but that is not required to fix the flow going forward.
