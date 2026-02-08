
# Plan: Switch to Google Drive `drive.file` Scope (Option A)

## Overview
The app will switch from the full `drive` scope (`https://www.googleapis.com/auth/drive`) to the more restrictive `drive.file` scope (`https://www.googleapis.com/auth/drive.file`). This reduces permissions and improves user trust, but with a tradeoff: the app will no longer try to detect existing folders and will always create new ones.

## Current Problem with Full Scope
- **Scope Used**: `https://www.googleapis.com/auth/drive` (full access to all files/folders)
- **Main Use**: The `findFolder` function in `google-drive-callback` searches user's root directory for existing "DocFlow AI" folders to avoid duplication
- **User Trust**: Full scope can feel excessive and raises privacy concerns
- **Permission Prompt**: Asking for full access when only app-created files are necessary

## What Changes with `drive.file` Scope
✅ **Still Works**:
- Create folders
- Upload files to app-created folders
- Share folders with Make.com
- Manage files within app-created directories
- Refresh tokens

❌ **Won't Work**:
- Search for existing folders in user's root directory
- Access user's pre-existing folder structure
- Detect and reuse "DocFlow AI" folders from previous connections

## Trade-offs

| Aspect | Full `drive` Scope | `drive.file` Scope |
|--------|-------------------|-------------------|
| **Permissions** | Full access to all Drive files | Only app-created files |
| **User Trust** | Lower (broad access) | Higher (limited access) |
| **Folder Detection** | ✅ Can detect existing folders | ❌ Cannot detect existing folders |
| **Behavior on Reconnect** | Reuses existing "DocFlow AI" folder | Creates new "DocFlow AI" folder each time |
| **Possible Duplicates** | No duplicates | Yes, multiple "DocFlow AI" folders if user reconnects multiple times |
| **Cleanup Effort** | None needed | User may see duplicate folders in Drive |

## Implementation Changes

### 1. Update `google-drive-auth/index.ts`
**Change the requested scope** (line 78-81):

```typescript
// Before
const scopes = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

// After
const scopes = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");
```

### 2. Update `google-drive-callback/index.ts`
**Remove the folder detection logic** and always create new folders:

```typescript
// Before (lines 134-165)
async function ensureDefaultFolderStructure(accessToken: string) {
  // Calls findOrCreateFolder → which calls findFolder first
  const docflowFolder = await findOrCreateFolder(accessToken, "DocFlow AI");
  // ... etc
}

// After
async function ensureDefaultFolderStructure(accessToken: string) {
  // Skip find, always create new folders
  const docflowFolder = await createDriveFolder(accessToken, "DocFlow AI");
  const migrationFolder = await createDriveFolder(
    accessToken,
    "Migration Services",
    docflowFolder.id
  );
  const clientsFolder = await createDriveFolder(
    accessToken,
    "Clients",
    migrationFolder.id
  );
  // ... rest of sharing logic
}
```

**Remove unused functions**:
- Delete `findFolder()` function (lines 10-45) — no longer needed
- Delete `findOrCreateFolder()` function (lines 82-96) — replace with direct `createDriveFolder` calls

### 3. Updated RLS Policy (if needed)
No changes to database structure or RLS. The `google_drive_connections` table remains the same.

## Expected Behavior

### On First Connection
1. User clicks "Connect Google Drive"
2. Google OAuth flow with **only** `drive.file` scope requested
3. User sees permission dialog: "This app will only access files and folders it creates"
4. User authorizes
5. App creates: `DocFlow AI / Migration Services / Clients` folder structure
6. Clients folder auto-shared with Make.com
7. Connection saved to database

### On Reconnection (if user reconnects later)
1. User clicks "Reconnect"
2. Previous connection is disconnected and removed
3. New OAuth flow with `drive.file` scope
4. App creates a **new** `DocFlow AI / Migration Services / Clients` structure
5. Result: User may have multiple "DocFlow AI" folders in their Drive root

⚠️ **Note**: Existing client/application folder links stored in `client_folder_id` and `visa_application_folder_id` still work — they point to the old folders. New clients will use the new folder structure.

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/google-drive-auth/index.ts` | Change scope from `drive` to `drive.file` |
| `supabase/functions/google-drive-callback/index.ts` | Remove `findFolder()` and `findOrCreateFolder()`; simplify `ensureDefaultFolderStructure()` to always create |

## Deployment & User Communication

1. **Existing Users**: Will need to **reconnect** Google Drive to grant new `drive.file` permissions. Old connections will fail when trying to use full `drive` scope.
2. **New Users**: Will see only the `drive.file` permission request
3. **Duplicate Folder Warning**: Users who reconnect multiple times will see multiple "DocFlow AI" folders in Drive root — this is expected but can be manually deleted

## Benefits
- ✅ **Better User Trust**: Minimal, specific permissions
- ✅ **Clearer Intent**: Only accesses app-created files
- ✅ **Google Play/App Store Friendly**: Reduced scope requirements for future mobile apps
- ✅ **Simpler Code**: Removes folder-finding logic

## Drawbacks
- ❌ **Potential Duplicates**: Reconnections create new folder structures
- ❌ **Manual Cleanup**: Users may need to delete old "DocFlow AI" folders
- ❌ **User Education**: Need to explain why they see multiple folders if they reconnect

