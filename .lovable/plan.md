

## Rename Google Drive folder to "DELETED_" on client deletion

### Problem
When a client is deleted, their Google Drive folder remains with the original name, making it hard to identify deleted clients' folders in Google Drive.

### Solution
Before deleting the client record from the database, rename their Google Drive folder by prepending "DELETED_" to the folder name. This will be done via a new edge function that uses the Google Drive API's `files.update` endpoint to rename the folder.

### Changes

**1. New Edge Function: `supabase/functions/google-drive-rename-folder/index.ts`**
- Accepts `companyId`, `folderId`, and `newPrefix` (e.g., "DELETED_")
- Authenticates the user and verifies company membership
- Gets the current folder name from Google Drive API
- Renames the folder by prepending the prefix to its current name
- Reuses the existing token decryption and refresh patterns from `internal-remove-attachment`

**2. Update `src/pages/migration/Clients.tsx`**
- In the `deleteClientMutation`, before deleting the client record, call the new edge function to rename the client's Google Drive folder (if `client_folder_id` exists)
- This is a best-effort operation -- if renaming fails, the client deletion still proceeds (with a console warning)

### Technical Details

The Google Drive rename API call:
```
PATCH https://www.googleapis.com/drive/v3/files/{folderId}
Body: { "name": "DELETED_{originalName}" }
```

The edge function will:
1. Verify auth and company membership
2. Fetch existing folder name via `GET /drive/v3/files/{folderId}?fields=name`
3. Rename via `PATCH /drive/v3/files/{folderId}` with `{ name: "DELETED_" + currentName }`
4. Use the same `getValidAccessToken` pattern from existing functions for token management

The frontend mutation flow becomes:
1. Rename Drive folder (if `client_folder_id` exists) -- best effort
2. Delete client record from database
3. Dispatch webhook

