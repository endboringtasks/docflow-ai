

## Fix: Store Drive Email Directly on Client Records

### Root Cause

The `google_drive_connections` table has a **unique constraint on `company_id`** -- only ONE record exists per company. When you reconnect with a different Google account, line 218 of `google-drive-callback` does an `upsert` with `onConflict: "company_id"`, **overwriting** the previous `connected_email`. So the JOIN in `get_clients_secure` always returns the latest email, not the one used when each client's folder was created.

The previous backfill approach (binding `google_drive_connection_id`) cannot work because there is only one connection record per company and its email keeps changing.

### Solution

Store the Google account email directly on each client record at the time its folder is created. This snapshot is immutable and independent of future reconnections.

### Changes

#### 1. Database Migration

- Add a `drive_created_email` column (text, nullable) to the `clients` table
- Update `get_clients_secure` RPC to return `drive_created_email` instead of joining to get the email (keep the JOIN as fallback)

```sql
ALTER TABLE clients ADD COLUMN IF NOT EXISTS drive_created_email text;

-- Update get_clients_secure to prefer the snapshot email
-- Returns: COALESCE(c.drive_created_email, gdc.connected_email) as drive_connected_email
```

#### 2. Update `webhook-client-folder` Edge Function

When binding the `google_drive_connection_id`, also look up and store the `connected_email` on the client:

```typescript
if (driveConn?.id) {
  updateData.google_drive_connection_id = driveConn.id;
  updateData.drive_created_email = driveConn.connected_email;
}
```

#### 3. Update `get_clients_secure` RPC

Change the return to prefer the snapshot:
```sql
COALESCE(c.drive_created_email, gdc.connected_email) as drive_connected_email
```

#### 4. No Frontend Changes Needed

The UI already uses `client.drive_connected_email` -- once the RPC returns the correct value, tooltips will show the right email automatically.

#### 5. Backfill Existing Data

For existing clients, set `drive_created_email` from the current connection email (best effort -- the original emails are lost since they were overwritten):
```sql
UPDATE clients c
SET drive_created_email = gdc.connected_email
FROM google_drive_connections gdc
WHERE gdc.company_id = c.company_id
  AND c.client_folder_id IS NOT NULL
  AND c.drive_created_email IS NULL;
```

### Important Note

For your three existing clients (zzzz, aaaa, nnnn), the original Google account emails that created each folder **cannot be recovered** because they were overwritten in the `google_drive_connections` record. The backfill will set them all to the current email (`anderri@gmail.com`). Going forward, new clients will correctly capture the email used at folder creation time.

### Files Summary

| File | Change |
|---|---|
| Database migration | Add `drive_created_email` column, update RPC, backfill |
| `supabase/functions/webhook-client-folder/index.ts` | Store `connected_email` on client at folder creation |

