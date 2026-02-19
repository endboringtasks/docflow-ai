

## Fix: Backfill `google_drive_connection_id` on Existing Clients

### Problem
All existing clients have `google_drive_connection_id = NULL` because the binding logic in `webhook-client-folder` was added after those clients were already created. The LEFT JOIN in `get_clients_secure` returns no email, so the tooltip falls back to `driveStatus?.connected_email` -- which is the **current** company-level connection (e.g., `anderson@endboringtasks.com`), not the account that originally created each folder.

### Solution

Run a one-time migration to backfill `google_drive_connection_id` for all existing clients that have a `client_folder_id` but no binding. Since each company only has one Drive connection, we can match by `company_id`.

### Changes

#### 1. Database Migration: Backfill existing clients

```sql
UPDATE clients c
SET google_drive_connection_id = gdc.id
FROM google_drive_connections gdc
WHERE c.company_id = gdc.company_id
  AND c.client_folder_id IS NOT NULL
  AND c.google_drive_connection_id IS NULL;
```

This sets the correct Drive connection for every existing client that has a folder but was never bound.

#### 2. No frontend changes needed

The `get_clients_secure` RPC already JOINs on `google_drive_connection_id` and returns `drive_connected_email`. Once the backfill populates the FK, the correct email will appear automatically in all tooltips.

### Files Summary

| File | Change |
|---|---|
| Database migration | Backfill `google_drive_connection_id` on existing clients |
