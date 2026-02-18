

## Add "Not Connected" Drive Status to Application Pages

### Overview
Replicate the same Google Drive disconnection UI pattern from the Clients page to both the Applications list and Application Detail pages, ensuring consistent UX across the platform.

### Changes

**File: `src/pages/migration/Applications.tsx`** (Applications list)

1. Add the Drive connection status query (same as Clients page):
   - Query `get_drive_connection_status` RPC with `currentCompany.id`
   - Derive `isDriveConnected` boolean

2. Add `AlertTriangle` to lucide-react imports

3. Update the folder status rendering (around lines 1145-1198):
   - If `folder_status === "created"` and folder ID exists: keep showing "Open Folder" (unchanged)
   - If Drive is **not connected** and folder is not created: show "Not Connected" badge with tooltip (same style as Clients page -- red accent, AlertTriangle icon, step-by-step instructions)
   - If Drive IS connected: keep existing creating/failed/pending logic

**File: `src/pages/migration/ApplicationDetail.tsx`** (Application detail)

1. Add the Drive connection status query (same pattern)

2. Add `AlertTriangle` to lucide-react imports

3. Update the Drive Folder section (around lines 1868-1905):
   - If `folder_status === "created"` and folder ID exists: keep "Open Folder" (unchanged)
   - If Drive is **not connected** and folder is not created: show "Not Connected" badge with tooltip instructions
   - If Drive IS connected: keep existing creating/failed/pending badges

### What stays the same
- No database or edge function changes
- "Open Folder" links always work when a folder was previously created
- Existing retry logic for failed folders (only shown when Drive is connected)
- No auto-folder-creation on reconnection for applications (that logic already exists at the client level and application folders are created via webhooks triggered by application creation)

