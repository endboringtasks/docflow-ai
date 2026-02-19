

## Reuse Existing Drive Folder on Reconnection

### Problem
Every time you reconnect Google Drive, the callback function creates a brand new "DocFlow AI / Migration Services / Clients" folder structure, resulting in dozens of duplicate folders (as seen in the screenshot).

### Solution
Before creating new folders, check if the company already has a `root_folder_id` stored in the database. If it does, verify the folder is still accessible in Drive and reuse it. Only create new folders if no previous folder exists or the old one is no longer accessible.

### Technical Changes

**File: `supabase/functions/google-drive-callback/index.ts`**

1. **Add a function to check if an existing folder is accessible:**
   ```typescript
   async function isFolderAccessible(accessToken: string, folderId: string): Promise<boolean> {
     try {
       const response = await fetch(
         `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,trashed`,
         { headers: { Authorization: `Bearer ${accessToken}` } }
       );
       if (!response.ok) return false;
       const file = await response.json();
       return !file.trashed;
     } catch {
       return false;
     }
   }
   ```

2. **Before creating folders, look up the existing connection:**
   At line ~184, before the folder creation block, query the database for the company's existing `root_folder_id`. If it exists, verify accessibility via the Drive API. If accessible, skip folder creation and reuse the existing ID.

   ```typescript
   // Check for existing root folder
   const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
   
   const { data: existingConnection } = await supabase
     .from("google_drive_connections")
     .select("root_folder_id, root_folder_name")
     .eq("company_id", companyId)
     .maybeSingle();

   let rootFolderId: string | null = null;
   let rootFolderName: string | null = null;

   if (existingConnection?.root_folder_id) {
     const accessible = await isFolderAccessible(access_token, existingConnection.root_folder_id);
     if (accessible) {
       rootFolderId = existingConnection.root_folder_id;
       rootFolderName = existingConnection.root_folder_name;
       console.log("Reusing existing root folder:", rootFolderName, rootFolderId);
     }
   }

   if (!rootFolderId) {
     // Only create new folder structure if no existing folder found
     try {
       const clientsFolder = await ensureDefaultFolderStructure(access_token);
       rootFolderId = clientsFolder.id;
       rootFolderName = "DocFlow AI / Migration Services / Clients";
     } catch (folderError) {
       console.error("Failed to create folder structure:", folderError);
     }
   }
   ```

3. **Move the `supabase` client creation earlier** since we now need it before the upsert (line 203). The same client instance is reused for both the lookup and the upsert.

### What This Achieves
- Reconnecting to the same Drive account reuses the existing "DocFlow AI" folder -- no duplicates
- If the folder was deleted or trashed, a new one is created automatically
- If connecting a completely new account (no existing folder), the normal creation flow runs
- Existing client/application subfolders remain intact and linked

| File | Change |
|---|---|
| `supabase/functions/google-drive-callback/index.ts` | Add folder accessibility check; reuse existing root folder on reconnection |

