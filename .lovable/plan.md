

## Fix: Manually Set Correct Drive Emails for Existing Clients

### Problem

The previous migration files were created but the UPDATE statements never executed against the actual data. Both "zzz" and "aaa" still have `drive_created_email = NULL` and `google_drive_connection_id = NULL`.

### Solution

Since you know the original emails used:
- **aaa** was created with `anderri@gmail.com`
- **zzz** was created with `anderson@endboringtasks.com`

We will set these values directly on each client record using individual UPDATE statements.

### Changes

#### 1. Data fix: Set correct emails on existing clients

Run two targeted UPDATEs to set the correct `drive_created_email` for each client:

```sql
-- aaa client: folder created with anderri@gmail.com
UPDATE clients 
SET drive_created_email = 'anderri@gmail.com'
WHERE id = '2b271c60-e486-4ed1-9eaf-50fa5d71ba87';

-- zzz client: folder created with anderson@endboringtasks.com
UPDATE clients 
SET drive_created_email = 'anderson@endboringtasks.com'
WHERE id = '7659d3cd-ea26-4cc8-a688-0b9dbfb6cf69';
```

Also set `google_drive_connection_id` to the current connection so the LEFT JOIN in `get_clients_secure` works as a fallback:

```sql
UPDATE clients 
SET google_drive_connection_id = 'a4b835e8-254b-449d-9dfc-3b7c5635c81f'
WHERE id IN (
  '2b271c60-e486-4ed1-9eaf-50fa5d71ba87',
  '7659d3cd-ea26-4cc8-a688-0b9dbfb6cf69'
);
```

#### 2. No code changes needed

The `get_clients_secure` RPC already returns `COALESCE(c.drive_created_email, gdc.connected_email)`, so once the data is populated, the correct email will display automatically in the UI tooltips.

### Files Summary

| Area | Change |
|---|---|
| Data (clients table) | Set `drive_created_email` to correct original emails for "aaa" and "zzz" |
| Data (clients table) | Set `google_drive_connection_id` for both clients |

