

## Revoke OAuth Token on Disconnect + Keep Folder IDs + Show Disconnected Warning

### Overview
When a user disconnects Google Drive, the system will revoke the OAuth token with Google, preserve all folder IDs, and show a warning banner on folder links indicating Drive is disconnected for the specific email.

### Changes

#### 1. Edge Function: `supabase/functions/google-drive-disconnect/index.ts`

**Current behavior:** Removes shared permissions from root folder, then deletes the `google_drive_connections` row entirely.

**New behavior:**
- **Revoke the OAuth token** by calling Google's revoke endpoint (`https://oauth2.googleapis.com/revoke?token={refreshToken}`) to fully remove app access from the user's Google Account
- **Keep the connection row** but clear tokens and mark it as disconnected:
  - Set `access_token` and `refresh_token` to empty strings
  - Set `root_folder_id` to `NULL` (this is what the UI uses to determine "connected" status)
  - **Preserve** `connected_email` so the UI can show which account was disconnected
  - Add a soft-delete approach: instead of `DELETE`, do an `UPDATE`

This way the `connected_email` is still available for the warning message, and `root_folder_id = NULL` means `isDriveConnected = false` in all UI queries.

#### 2. Database: Add `disconnected_at` column to `google_drive_connections`

Add a nullable `timestamptz` column `disconnected_at` to track when the connection was disconnected. When this is non-null and `root_folder_id` is null, the connection is in "disconnected" state.

#### 3. Update `get_drive_connection_status` RPC function

Currently this function returns the connection row. It will continue to do so -- but now the row will persist after disconnect with `root_folder_id = NULL` and `disconnected_at` set. The existing `isDriveConnected = !!driveStatus?.root_folder_id` check in the UI already handles this correctly.

#### 4. Frontend: Update `useDriveBackfill.ts`

Expose `driveStatus` (including `connected_email` and `disconnected_at`) so UI components can show the warning.

#### 5. Frontend: Update folder link rendering in 4 pages

When Drive is disconnected but a folder ID exists, show the "Open Folder" link with a warning indicator (amber/yellow styling) and a tooltip saying "Google Drive disconnected for xyz@gmail.com. Folder may not be accessible."

**Files affected:**
- `src/pages/migration/Clients.tsx` -- client folder column
- `src/pages/migration/ClientDetail.tsx` -- client detail folder link
- `src/pages/migration/Applications.tsx` -- application folder column
- `src/pages/migration/ApplicationDetail.tsx` -- application detail folder link

The logic change: instead of the current `folder_status === "created" && client_folder_id` showing "Open Folder" vs `!isDriveConnected` showing "Not Connected", the new logic is:

```text
if folder_status === "created" && folder_id exists:
  if isDriveConnected:
    show "Open Folder" (green, normal)
  else:
    show "Open Folder" (amber, with warning tooltip: "Drive disconnected for email")
else if !isDriveConnected:
  show "Not Connected" badge
else:
  show creating/failed/pending states
```

#### 6. Frontend: Update disconnect dialog text

Update `GoogleDriveConnection.tsx` disconnect dialog to reflect that folder links will be preserved (not "permanently removed"). After disconnect, show a disconnected state with the email and a "Reconnect" button instead of clearing the connection entirely.

#### 7. Frontend: Update `GoogleDriveConnection.tsx` post-disconnect state

After disconnect, instead of setting `connection` to `null`, keep the connection object with the disconnected state so the UI shows "Disconnected" with the email and a reconnect option.

### Technical Details

**Token Revocation (Edge Function):**
```typescript
// Revoke the refresh token with Google
async function revokeToken(token: string): Promise<boolean> {
  const response = await fetch(
    `https://oauth2.googleapis.com/revoke?token=${token}`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return response.ok;
}
```

**Database Migration:**
```sql
ALTER TABLE google_drive_connections 
ADD COLUMN disconnected_at timestamptz DEFAULT NULL;
```

**Edge Function UPDATE instead of DELETE:**
```sql
UPDATE google_drive_connections 
SET access_token = '', refresh_token = '', root_folder_id = NULL, 
    root_folder_name = NULL, disconnected_at = NOW(), tokens_encrypted = false
WHERE company_id = companyId;
```

**Reconnect flow:** The existing `handleReconnect` in `GoogleDriveConnection.tsx` already calls disconnect then starts a new OAuth flow. The `google-drive-callback` function will update the existing row (since it's `company_id` unique) with new tokens, clearing `disconnected_at`.

### Files Summary

| File | Change |
|---|---|
| `supabase/functions/google-drive-disconnect/index.ts` | Add token revocation, UPDATE instead of DELETE |
| Database migration | Add `disconnected_at` column |
| `src/pages/migration/Clients.tsx` | Show folder link with warning when disconnected |
| `src/pages/migration/ClientDetail.tsx` | Show folder link with warning when disconnected |
| `src/pages/migration/Applications.tsx` | Show folder link with warning when disconnected |
| `src/pages/migration/ApplicationDetail.tsx` | Show folder link with warning when disconnected |
| `src/components/settings/GoogleDriveConnection.tsx` | Update disconnect dialog text, show disconnected state |
| `src/hooks/useDriveBackfill.ts` | Expose `connected_email` from driveStatus |
