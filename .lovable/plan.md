

## Definitive Fix: Set Drive Email in the Correct Edge Function

### Root Cause (Found This Time)

The previous fixes targeted `webhook-client-folder`, but that function is **never called** in the actual flow. The real flow is:

1. Frontend calls `dispatch-webhook` with `client.created` event
2. `dispatch-webhook` sends data to Make.com
3. Make.com creates the folder and responds with `client_folder_id`
4. **`dispatch-webhook` itself updates the `clients` table** (lines 494-502) -- but only sets `client_folder_id`, `folder_status`, and `folder_status_updated_at`
5. It **never sets** `drive_created_email` or `google_drive_connection_id`

So every new client ends up with `drive_created_email = NULL`, the RPC returns NULL for `drive_connected_email`, and the frontend falls back to the current company-level email.

### Changes

#### 1. Fix `dispatch-webhook/index.ts` -- set drive email when updating client folder

After successfully extracting the folder ID and before updating the client record (~line 494), look up the active Google Drive connection for the company and include `drive_created_email` and `google_drive_connection_id` in the update:

```typescript
// Around line 489, when folderId is found and entityType === "client":
// Look up Drive connection to snapshot the email
const companyId = (hydratedData as any).company_id ?? (payload.data as any).company_id;
let driveUpdateFields: Record<string, unknown> = {};
if (companyId) {
  const { data: driveConn } = await supabase
    .from("google_drive_connections")
    .select("id, connected_email")
    .eq("company_id", companyId)
    .maybeSingle();
  if (driveConn) {
    driveUpdateFields = {
      google_drive_connection_id: driveConn.id,
      drive_created_email: driveConn.connected_email,
    };
  }
}

// Then include driveUpdateFields in the update call:
.update({
  [folderColumn]: folderId,
  folder_status: "created",
  folder_status_updated_at: new Date().toISOString(),
  ...driveUpdateFields,  // <-- adds drive_created_email + connection_id
})
```

#### 2. Fix frontend fallback in `Clients.tsx` (line 805)

Remove the fallback to `driveStatus?.connected_email`. Only show the email from the RPC (which is the snapshot email):

```
Before: client.drive_connected_email || driveStatus?.connected_email
After:  client.drive_connected_email
```

#### 3. Fix frontend fallback in `Applications.tsx` (line 1200)

Same fix -- remove fallback to `driveStatus?.connected_email`:

```
Before: clientObj?.drive_connected_email || driveStatus?.connected_email
After:  clientObj?.drive_connected_email
```

#### 4. Backfill the two newly created clients

Run a data update to set the correct values for the two clients created today (anderson and anderri), since they went through the broken flow:

```sql
UPDATE clients c
SET 
  google_drive_connection_id = 'a4b835e8-254b-449d-9dfc-3b7c5635c81f',
  drive_created_email = 'anderson@endboringtasks.com'
WHERE id IN (
  '54479a7d-6346-4c17-a71f-ba422f678ef1',
  'cec07f6f-5bb8-4c25-bca3-4d95fed409eb'
)
AND drive_created_email IS NULL;
```

### Why This Is Definitive

- Targets the **actual code path** that runs when folders are created (dispatch-webhook, not webhook-client-folder)
- Removes the frontend fallback that was masking the issue by always showing the current email
- Backfills the two records that went through the broken flow

### Files Summary

| File | Change |
|---|---|
| `supabase/functions/dispatch-webhook/index.ts` | Set `drive_created_email` and `google_drive_connection_id` when updating client with folder ID |
| `src/pages/migration/Clients.tsx` | Remove fallback to `driveStatus?.connected_email` |
| `src/pages/migration/Applications.tsx` | Remove fallback to `driveStatus?.connected_email` |
| Database (data fix) | Backfill 2 new clients with correct email |

