

## Per-Client Drive Account Mismatch Detection

### Problem

Currently, `isDriveConnected` is a single global boolean (`!!driveStatus?.root_folder_id`) -- it only checks whether the company has any active Drive connection. It does not compare the client's `drive_created_email` against the current connection's `connected_email`.

Result: The "gmail" client (folder created with `anderri@gmail.com`) shows a green "Open Folder" button even though the current connection is `anderson@endboringtasks.com`. The folder lives in a different Google account and may not be accessible.

### Expected Behavior

Three possible states for each client's folder button:

| State | Condition | Appearance |
|---|---|---|
| Connected (green) | Drive connected AND `drive_created_email` matches current `connected_email` (or no snapshot email) | Green "Open Folder" |
| Mismatched (amber) | Drive connected BUT `drive_created_email` differs from current `connected_email` | Amber "Open Folder" with warning icon and tooltip explaining mismatch |
| Disconnected (red) | No active Drive connection at all | Red "Not Connected" with warning |

### Changes

#### 1. `src/pages/migration/Clients.tsx` -- Add per-client mismatch detection

In the folder status rendering section (around line 780), replace the simple `isDriveConnected` check with a per-client check:

```typescript
// For each client row, compute:
const clientDriveEmail = client.drive_connected_email;
const currentDriveEmail = driveStatus?.connected_email;
const isDriveMismatch = isDriveConnected && clientDriveEmail && currentDriveEmail 
  && clientDriveEmail !== currentDriveEmail;
```

Then use `isDriveMismatch` to show amber styling and a tooltip like:
- "Folder created with anderri@gmail.com, but Drive is now connected to anderson@endboringtasks.com. Folder may not be accessible."

When `isDriveMismatch` is true, show amber styling (same as disconnected warning) with the mismatch tooltip.
When `isDriveConnected && !isDriveMismatch`, show green styling with "Opens in Google Drive".
When `!isDriveConnected`, keep existing disconnected behavior.

#### 2. `src/pages/migration/Applications.tsx` -- Same mismatch detection

Apply the same logic for application folder buttons (around line 1175), looking up the client's `drive_connected_email` via the `clients` array.

### Technical Details

- No database or edge function changes needed -- all data is already available
- `client.drive_connected_email` comes from the `get_clients_secure` RPC
- `driveStatus?.connected_email` comes from the existing Drive status query
- The comparison is a simple string equality check

### Files Summary

| File | Change |
|---|---|
| `src/pages/migration/Clients.tsx` | Add per-client `isDriveMismatch` check; show amber warning with mismatch tooltip |
| `src/pages/migration/Applications.tsx` | Same mismatch detection for application folder buttons |

