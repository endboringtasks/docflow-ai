

## Skip Google Drive folder operations when Drive is not connected

### Problem
When deleting a client whose Google Drive folder was never created (because Drive is not connected), the app still attempts to call the `google-drive-rename-folder` edge function unnecessarily. Additionally, folder creation webhooks are dispatched even when there's no Drive connection, leading to "Failed" folder statuses.

### Solution
1. **Delete mutation**: Only attempt the Drive folder rename if the client actually has a folder (`client_folder_id` exists AND `folder_status` is not "failed"). The current check already gates on `client_folder_id`, but we should also show a more descriptive success message depending on whether a folder rename was attempted.

2. **Create mutation**: Before dispatching the `client.created` webhook (which triggers folder creation), check if Drive is connected by verifying `rootFolderId` exists. If not, skip the webhook entirely -- no point triggering folder creation when there's no Drive connection.

3. **Retry folder button**: Before allowing retry, check if Drive is connected and show an appropriate error if not.

4. **Delete success message**: Customize the toast to indicate whether the Drive folder was renamed or not.

### Technical Details

**File: `src/pages/migration/Clients.tsx`**

Changes to the **create mutation** (around line 207):
- Wrap the webhook dispatch in a condition: only call `dispatch-webhook` for `client.created` if `rootFolderId` is not null. This prevents folder creation attempts when Drive is not connected.

Changes to the **delete mutation** (around line 245):
- Add an additional condition: only call `google-drive-rename-folder` if `client.folder_status` is not `"failed"` (meaning the folder was actually created successfully).
- Update the success toast to reflect whether the folder was renamed.

Changes to the **retry folder mutation** (around line 374):
- Before dispatching the webhook, check if `rootFolderId` exists. If not, throw an error with a clear message: "Google Drive is not connected. Please connect Google Drive in Settings first."

