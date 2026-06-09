# Speed up Client & Application creation

## Problem
Creating a client or application takes 5+ seconds before the dialog closes. The actual database `INSERT` is fast (well under a second). The delay is caused by the UI **waiting (`await`) for the Google Drive folder-creation webhook** to make a full round-trip to Make.com and back.

Evidence from the edge logs: from `Sending to webhook` to `Webhook ... succeeded` is ~3–4 seconds (Make.com creates the Drive folder and returns the folder IDs synchronously). The creation dialog stays in the "Creating..." state for that entire round-trip even though the record already exists.

## Goal
The dialog should close and the record should appear within ~1 second. The Drive folder should still be created in the background, and its status should update on the row afterwards (this already works via `folder_status` + realtime + the `timeout-folder-creation` cron).

## Approach
Stop blocking the UI on the webhook. The record is inserted and `folder_status` is set to `creating`/`pending` immediately; the dialog closes right away. The webhook is still dispatched, but as a non-blocking background call. When Make.com responds, `dispatch-webhook` updates the row's `folder_id`/`folder_status` and the list refreshes via the existing realtime/invalidation, swapping the "creating" badge for the folder link.

### Clients — `src/pages/migration/Clients.tsx`
In `createClientMutation` (around lines 195–254):
- Keep the `INSERT` and the `folder_status: "pending"` update awaited (fast).
- Change the `await supabase.functions.invoke("dispatch-webhook", ...)` (line ~233) to a **fire-and-forget** call: invoke without `await`, attach a `.catch()` to log failures. Return `data` immediately afterward so `onSuccess` closes the dialog without waiting for Make.com.

### Applications — `src/pages/migration/Applications.tsx`
In `createApplicationMutation`:
- `mutationFn` (lines 409–425) already only does the `INSERT` — fast, leave as is.
- In `onSuccess` (lines 427–531), reorder so the UI closes first:
  - Move the `queryClient.invalidateQueries(...)`, `setIsCreateOpen(false)`, and form reset to run **immediately**.
  - Make the `dispatch-webhook` call (line ~450) **fire-and-forget** (no `await`, with `.catch()` logging). The two lookups it depends on (`google_drive_connections`, `clients`) move inside that background block.
  - Keep the applicant-record inserts (`application_applicants` / `application_timeline`) running, but they no longer hold the dialog open.

## What stays the same
- No database, RLS, or edge-function changes.
- `dispatch-webhook` still runs and updates `folder_id` / `folder_status` when Make.com responds.
- The "creating" badge → folder-link transition still happens via the existing `folder_status` realtime/polling.
- The `timeout-folder-creation` cron still flips stuck rows to `failed`.

## Technical notes / trade-offs
- Fire-and-forget `fetch` started by `supabase.functions.invoke` continues even after the dialog unmounts (it is not tied to the component lifecycle), so the folder is still created.
- The brief window where a new row shows `folder_status = creating` is expected and already has UI handling.
- If the webhook ultimately fails, the row shows the existing `failed` state with its retry action — same as today, just no longer blocking creation.
