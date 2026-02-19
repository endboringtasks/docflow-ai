

## Fix: Backfill Missing Drive Email Data and Prevent Fallback

### Problem

Two issues are causing the wrong email to display:

1. **Backfill didn't apply**: Your company's clients ("nnn" and "mmmm") still have `drive_created_email = NULL` and `google_drive_connection_id = NULL`. The migration file was created but the UPDATE didn't take effect on the actual data.

2. **Frontend fallback**: When `drive_connected_email` from the RPC is NULL, the UI falls back to `driveStatus?.connected_email` (the current company-level connection), which always shows the latest connected account -- not the one that created the folder.

### Root Cause

The `get_clients_secure` RPC uses `COALESCE(c.drive_created_email, gdc.connected_email)`, but since `google_drive_connection_id` is also NULL, the LEFT JOIN returns nothing, so the entire `drive_connected_email` result is NULL. The frontend then falls back to the company-level email.

### Solution

#### 1. Run the Backfill Manually (Data Fix)

Execute the backfill UPDATE to populate both `google_drive_connection_id` and `drive_created_email` for clients that have folders but are missing these fields:

```sql
UPDATE clients c
SET 
  google_drive_connection_id = gdc.id,
  drive_created_email = gdc.connected_email
FROM google_drive_connections gdc
WHERE gdc.company_id = c.company_id
  AND c.client_folder_id IS NOT NULL
  AND c.drive_created_email IS NULL;
```

This will set both clients ("nnn" and "mmmm") to `anderson@endboringtasks.com` -- this is the best we can do since the original emails were overwritten.

### Important Limitation

For your existing clients, the original Google account emails that created each folder **cannot be recovered** because they were overwritten when you reconnected with different accounts. The backfill will set them all to the current email (`anderson@endboringtasks.com`). Going forward, new client folders will correctly capture the specific email used at creation time.

### Technical Details

| Area | Change |
|---|---|
| Data (clients table) | Backfill `google_drive_connection_id` and `drive_created_email` for 2 clients with NULL values |

### Files Summary

No code file changes needed -- only a data UPDATE to populate the missing fields.
