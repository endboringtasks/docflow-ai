
# Implementation Plan: Handle Client-Deleted Documents in Google Drive and History

## Overview
Three key changes to properly handle when a client deletes a document from the portal:
1. **Rename Drive files** with "DELETED_" prefix instead of just removing them from the record
2. **Update history display** to show "Deleted by Client" instead of "Reviewed" based on `archived_reason`
3. **Apply conditional styling** to visually distinguish client deletions from agent rejections

## File Changes

### 1. Update Edge Function: `supabase/functions/client-portal-remove-document/index.ts`

**Current State:**
- The function archives attachments with `archived_reason: 'client_deleted'` ✓ (already done)
- The function preserves `pending_client` status ✓ (already done)
- BUT: Google Drive files are skipped for removal instead of being renamed with "DELETED_" prefix

**Changes Needed:**
- Add imports for token decryption at the top:
  ```ts
  import { decryptToken, isEncrypted, encryptToken } from '../_shared/token-encryption.ts'
  ```
- Add constants for Google credentials:
  ```ts
  const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
  const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
  ```
- Copy two helper functions from `client-portal-upload/index.ts`:
  - `getValidAccessToken()` - handles token decryption, refresh, and re-encryption
  - `renameGoogleDriveFile()` - calls Google Drive API to rename a file

- **In the attachment flow** (around line 141-150):
  - Replace the simple storage removal with Google Drive rename logic
  - When deleting a Drive file (`drive://` path), rename it to `DELETED_{original_filename}`
  - Keep Supabase storage file removal as-is

- **In the legacy flow** (around line 264-277):
  - Apply same rename logic to any Drive attachments before deletion
  - Extract Drive files from the attachment list and rename them

**Key Logic:**
```ts
// For Drive files
if (filePath && filePath.startsWith('drive://')) {
  const driveFileId = filePath.replace('drive://', '')
  const accessToken = await getValidAccessToken(supabase, portalAccess.company_id)
  if (accessToken) {
    const deletedName = `DELETED_${attachmentData.file_name}`
    await renameGoogleDriveFile(accessToken, driveFileId, deletedName)
  }
}
// For Supabase storage files
else if (filePath) {
  await supabase.storage.from('document-attachments').remove([filePath])
}
```

### 2. Update Component: `src/components/visa-application/DocumentHistorySection.tsx`

**Current State:**
- Lines 272-278 always show "Reviewed" with destructive red styling for all archived documents
- No distinction between rejected documents and client-deleted documents

**Changes Needed:**
- **Lines 266-280** (timeline dot and status display):
  - Add conditional rendering based on `entry.archived_reason`
  - If `archived_reason === 'client_deleted'`: 
    - Use `Trash2` icon instead of `XCircle`
    - Show "Deleted by Client {timestamp}" instead of "Reviewed {timestamp}"
    - Use `text-muted-foreground` color instead of `text-destructive`
    - Remove reviewer name display (not applicable for client deletions)
  - If archived_reason is anything else (rejected, rejected_replacement):
    - Keep existing "Reviewed" text and destructive red styling
    - Keep `XCircle` icon
    - Keep reviewer name display

- **Lines 218-220** (timeline dot styling):
  - Change from hardcoded destructive red to conditional based on `archived_reason`
  - If `client_deleted`: use muted/neutral color classes
  - Otherwise: keep destructive red

- **Lines 211-213** (card background styling):
  - Change from hardcoded `bg-destructive/5` to conditional
  - If `client_deleted`: use neutral background like `bg-muted/30` or `bg-background`
  - Otherwise: keep `bg-destructive/5` and `border-destructive/20`

**Visual Distinction:**
```
Rejected Document (existing style):
- Red dot (destructive)
- Red/destructive card background
- "Reviewed" text with red icon

Deleted by Client (new style):
- Muted/gray dot (muted-foreground)
- Neutral/muted card background  
- "Deleted by Client" text with trash icon
```

### 3. No Breaking Changes
- The `DocumentHistoryEntry` interface already includes `archived_reason` field
- The database already records the reason for archival
- The edge function already stores `archived_reason: 'client_deleted'`
- All styling changes are conditional based on existing data

## Implementation Order
1. Copy helper functions from `client-portal-upload` to `client-portal-remove-document`
2. Add Google Drive rename logic to both attachment and legacy flows
3. Update DocumentHistorySection component to show different UI based on `archived_reason`
4. Deploy the edge function
5. Test end-to-end: delete a document and verify it appears as "Deleted by Client" in history with correct styling

## Files to Modify
| File | Changes |
|------|---------|
| `supabase/functions/client-portal-remove-document/index.ts` | Add token/encryption imports, copy helper functions, add Drive rename logic |
| `src/components/visa-application/DocumentHistorySection.tsx` | Conditional rendering for "Deleted by Client" vs "Reviewed", conditional styling |

## Edge Functions to Deploy
- `client-portal-remove-document`

