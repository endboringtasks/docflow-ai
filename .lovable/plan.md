

## Google Drive Reconnection Backfill — Application Folders

### What's Already Done (No Changes Needed)
- **Part 1 (Immutable Binding)**: DB triggers `prevent_client_drive_rebind` and `prevent_application_drive_rebind` already enforce immutability on `google_drive_connection_id` and `client_folder_id`.
- **Part 2 (Application Inheritance)**: DB trigger `validate_application_drive_binding` auto-copies the client's Drive binding to new applications. Frontend blocks creation on mismatch.
- **Client Backfill on Reconnection**: Already implemented in `Clients.tsx` -- when Drive transitions from disconnected to connected, it finds clients without folders and dispatches `client.created` webhooks to trigger folder creation via Make.com.

### What's New
Application folder backfill on Drive reconnection is missing. When Drive reconnects, only client folders are created today -- applications without folders are not handled.

---

### Changes

**File: `src/pages/migration/Clients.tsx`**

Extend the existing `createPendingFolders` function (lines 191-242) to also backfill application folders:

1. After dispatching client folder creation webhooks, query `visa_applications` where `visa_application_folder_id IS NULL` and the client either has no Drive binding or matches the current connection.
2. For each eligible application:
   - Set `folder_status = 'pending'`
   - Dispatch `application.created` webhook with `application_id`, `client_folder_id`, `company_id`, and `root_folder_id`
3. Only dispatch application folder webhooks for applications whose parent client already has a `client_folder_id` (to avoid creating application folders before the parent client folder exists).
4. Applications whose client folder is still pending will get their folders created when the client detail page is opened or when a future reconnection detects them.

**Webhook event type**: Use the existing `application.created` event (same as normal creation flow) since Make.com already handles this event to create application folders.

### Technical Details

Inside the existing `useEffect` reconnection handler in `Clients.tsx`:

```text
After client folder dispatch loop:
  1. Query visa_applications for current company where visa_application_folder_id IS NULL
  2. Join/filter: only applications whose client has client_folder_id set (folder already exists)
  3. Filter by Drive binding: unbound or matching current connection
  4. For each eligible application:
     - Update folder_status to 'pending'
     - Dispatch 'application.created' webhook with application details
  5. Show toast: "Creating folders for N application(s)..."
```

### Summary

| Area | Status |
|---|---|
| Immutable binding (DB triggers) | Already implemented |
| Application inheritance (DB trigger) | Already implemented |
| Frontend mismatch blocking | Already implemented |
| Client folder backfill on reconnect | Already implemented |
| **Application folder backfill on reconnect** | **New -- to be added** |

### Files to Change

| File | Change |
|---|---|
| `src/pages/migration/Clients.tsx` | Add application folder backfill logic after client folder backfill in the reconnection useEffect |

