# Real-Time Notification Delivery (DOC-71)

## Current state
- A `notifications` table already exists with `user_id, type, title, message, metadata (jsonb), is_read, read_at, created_at`. This satisfies BR-1/BR-2.
- RLS is already correct (BR-6/BR-15): users can only `SELECT`/`UPDATE` their own rows; company members can `INSERT`.
- `NotificationBell` already renders the bell, unread badge, list, mark-as-read, and deep-linking — but it relies on **30-second polling** (`refetchInterval: 30000`), not Realtime.
- Realtime is **not** enabled on the table (not in the `supabase_realtime` publication, default replica identity).

So the work is: turn on Realtime at the DB level and switch the UI from polling to a live subscription that dedupes and reconciles on reconnect.

## 1. Database migration — enable Realtime
- `ALTER TABLE public.notifications REPLICA IDENTITY FULL;`
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;`

This lets Supabase emit insert/update events. RLS already restricts delivery to the recipient (BR-5, BR-6), so no policy changes are needed.

## 2. New hook: `useNotifications` (`src/hooks/useNotifications.tsx`)
Extract the data layer out of `NotificationBell` into a reusable hook so it can be shared and tested:
- Initial fetch via React Query (persisted notifications — BR-12, AC-4): select latest 20 for the user, ordered `created_at` desc (BR-8).
- Subscribe to a Supabase channel filtered to `user_id=eq.<id>` on `postgres_changes` for `INSERT` and `UPDATE` (BR-5, BR-7).
  - On `INSERT`: prepend to the cache, deduplicating by notification `id` (BR-9, TC-4); fire a toast and let the badge increment naturally (UI-3, PF-1 step 5).
  - On `UPDATE`: replace the matching row in cache (keeps read state in sync across tabs).
- Reconnect handling (BR-13, PF-3, TC-3): on the channel `subscribe` status callback, when status becomes `SUBSCRIBED` after a drop, `invalidateQueries` to refetch and reconcile missed notifications. Keep a lightweight `refetchInterval` fallback (e.g. 60s) only as a safety net for fully degraded realtime (UI-6, BR-12).
- Expose: `notifications`, `unreadCount`, `isLoading`, `markAsRead`, `markAllAsRead`, and a `realtimeConnected` flag.
- Mutations set `is_read=true, read_at=now()` (BR-10/BR-11, TC-5).

## 3. Refactor `NotificationBell`
- Consume `useNotifications` instead of holding its own queries/mutations.
- Keep existing visuals (bell, unread badge, list with title/message/timestamp, read/unread styling, deep-link on click — UI-1/2/4).
- Remove the 30s polling logic (now handled by realtime + safety fallback).

## 4. Toast on new notification
- Use the existing `useToast`/`sonner` setup to surface a brief toast when a realtime INSERT arrives while the panel is closed (PF-1).

## Out of scope (per BDD)
Email/SMS/push, notification preferences, cross-device guarantees beyond table persistence.

## Verification
- Confirm `notifications` is in the `supabase_realtime` publication after migration.
- In preview: insert a notification row for the logged-in user via the insert tool and confirm it appears instantly with badge increment and toast (AC-1, TC-1), and that a second identical event does not duplicate it (TC-4).
- Reload to confirm persistence (AC-4); mark-as-read decrements badge (TC-5).

## Technical notes
- Channel name should be unique per user (e.g. `notifications-user-<id>`) and cleaned up on unmount, mirroring the pattern in `useFolderStatusRealtime.ts`.
- No `service_role` or secrets touched; inserts continue to come from existing server/edge paths (BR-14).
