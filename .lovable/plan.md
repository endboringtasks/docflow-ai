

## Fix: Show Correct Google Account Email Per Client/Application

### Problem
When multiple clients were created under different Google Drive accounts, the "disconnected" warning tooltip shows the same email for all of them. This happens because the tooltip uses `driveStatus?.connected_email` (the company-level connection), not the email from each client's individually bound `google_drive_connection_id`.

### Solution
Include the bound Drive email in the data returned for each client and application, so the tooltip shows the correct account.

### Changes

#### 1. Database Migration: Update `get_clients_secure` RPC

Add a LEFT JOIN to `google_drive_connections` to return the `connected_email` for each client's bound Drive connection:

```sql
DROP FUNCTION IF EXISTS public.get_clients_secure(uuid);

CREATE OR REPLACE FUNCTION public.get_clients_secure(p_company_id uuid)
RETURNS TABLE(
  id uuid, company_id uuid, client_type text, first_name text, 
  last_name text, company_name text, email text, phone text, 
  client_folder_id text, folder_status text, created_at timestamptz,
  drive_connected_email text
)
...
  SELECT 
    c.id, c.company_id, c.client_type::text, ...
    gdc.connected_email as drive_connected_email
  FROM public.clients c
  LEFT JOIN public.google_drive_connections gdc 
    ON gdc.id = c.google_drive_connection_id
  WHERE c.company_id = p_company_id
  ORDER BY c.created_at DESC;
```

#### 2. Update TypeScript Types

Add `drive_connected_email` to the `get_clients_secure` return type in `src/integrations/supabase/types.ts`.

#### 3. Update `src/pages/migration/Clients.tsx`

Change the tooltip from:
```
driveStatus?.connected_email
```
to:
```
client.drive_connected_email || driveStatus?.connected_email
```

This way each client shows the email of the Google account that actually created its folder.

#### 4. Update `src/pages/migration/Applications.tsx`

Applications inherit their Drive binding from their parent client. Fetch the client's `drive_connected_email` alongside application data so each application tooltip shows the correct email. This can be done by looking up the client's bound email from the already-fetched clients data (which now includes `drive_connected_email`).

#### 5. Update `src/pages/migration/ClientDetail.tsx` and `src/pages/migration/ApplicationDetail.tsx`

Same change: use the per-record bound email in the tooltip instead of the global `driveStatus?.connected_email`.

### Files Summary

| File | Change |
|---|---|
| Database migration | Update `get_clients_secure` to JOIN and return `drive_connected_email` |
| `src/integrations/supabase/types.ts` | Add `drive_connected_email` to return type |
| `src/pages/migration/Clients.tsx` | Use `client.drive_connected_email` in tooltip |
| `src/pages/migration/Applications.tsx` | Use per-client bound email in tooltip |
| `src/pages/migration/ClientDetail.tsx` | Use bound email in tooltip |
| `src/pages/migration/ApplicationDetail.tsx` | Use bound email in tooltip |
