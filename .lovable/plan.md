# Audit Log Viewing (DOC-62)

## Context
The platform already has an Audit Logs page (`src/pages/admin/AuditLogs.tsx`), a route (`/admin/audit-logs`), admin-only access (`AdminProtectedRoute` + `is_platform_admin` RLS on `platform_audit_logs`), and the table columns (action, entity type, entity ID, timestamp, user, IP, details preview). This work closes the remaining gaps against the BDD rather than rebuilding from scratch.

The `platform_audit_logs` table already has all required fields: `action`, `entity_type`, `entity_id`, `details` (jsonb), `ip_address`, `created_at`, `user_id`. No database changes are needed — RLS already restricts SELECT to platform admins (AC-1, BR-6, PERM-1).

## Gaps to close
1. **Action-type filter (UI-2, BR-8, AC-5)** — current page filters by *entity type*, not *action*. Add an Action dropdown populated with distinct actions (e.g. `impersonate_start`, `delete_user`). Keep the existing entity-type filter and search; all filters combine (BR-9). Date-range picker already exists.
2. **Details panel (PF-3, UI-5, UI-6, AC-3)** — clicking a row opens a side panel (shadcn `Sheet`) showing pretty-printed JSON `details`, actor user, timestamp, action, entity reference, and IP address. Include a copy-to-clipboard button for the JSON.
3. **Secret redaction (BR-7, PERM-2, TC-6)** — before rendering JSON in the panel and the inline preview, recursively mask values whose keys match sensitive patterns (`token`, `access_token`, `refresh_token`, `password`, `secret`, `api_key`, `authorization`, `client_secret`) with `"***REDACTED***"`.
4. **Pagination, newest first (UI-3, BR-10, AC-6)** — replace the single `.limit(500)` fetch with server-side range pagination (e.g. 50 rows/page) ordered by `created_at desc`, with Prev/Next controls and a page indicator using Supabase `.range()` and `count: "exact"`.
5. **Error + retry (BR-12)** — when the query errors, show a clear error state with a Retry button (react-query `refetch`).

## Technical details
- All changes are confined to `src/pages/admin/AuditLogs.tsx` (presentation/data-fetching only); no schema or RLS changes.
- **Action filter options:** add a small react-query call selecting distinct `action` values (simple `select("action")` + client-side de-dupe, ordered) to populate the dropdown. Action filter applied server-side via `.eq("action", ...)` when not "all".
- **Pagination state:** `page` state; query key includes `page`, `actionFilter`, `entityFilter`, date range. Fetch uses `.order("created_at",{ascending:false}).range(page*size,(page+1)*size-1)` with `{ count: "exact" }`. Move the email/display_name search to be combined with server filters (keep client-side text search on the current page, or note it only searches the loaded page).
- **Redaction helper:** pure function `redactSecrets(value)` that deep-clones and masks matching keys; used both for the inline preview cell and the details panel.
- **Details panel:** new `Sheet` (already in the UI kit) controlled by `selectedLog` state; `<pre>` block with `JSON.stringify(redacted, null, 2)`; copy button uses `navigator.clipboard.writeText` + toast.
- Row gets `onClick` + `cursor-pointer`; keep existing company-filter badge behavior intact.

## Verification
- As a platform admin, open Admin → Audit Logs: list loads newest-first, paginated (AC-2, AC-6).
- Filter by an action (e.g. `delete_user`) and a date range — only matching rows show (AC-5, TC-3, TC-4).
- Click a row — panel shows pretty JSON, actor, timestamp, entity, IP; copy works (AC-3, AC-4, TC-5).
- Insert/confirm a details payload containing a `token`/`access_token` field renders as `***REDACTED***` (TC-6).
- Non-admins remain blocked via existing route guard + RLS (AC-1, TC-1).
