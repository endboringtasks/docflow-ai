

## Comply with CDR: Actually Delete Files, Keep Audit Metadata

### Problem
Currently, when a client deletes a document, Google Drive files are only **renamed** with a `DELETED_` prefix -- the actual file content remains accessible. This violates Consumer Data Right principles requiring the customer's data to be truly deleted upon request.

### Changes

**File: `supabase/functions/client-portal-remove-document/index.ts`**

1. Replace the `renameGoogleDriveFile` helper with a `deleteGoogleDriveFile` helper that calls `DELETE https://www.googleapis.com/drive/v3/files/{fileId}` instead of `PATCH`
2. In the attachment deletion flow (line ~271-280): call `deleteGoogleDriveFile` instead of `renameGoogleDriveFile`
3. In the legacy flow (line ~390-410): same replacement -- delete Drive files instead of renaming
4. The `file_path` stored in `document_attachment_history` remains as audit metadata (file name, size, type, who uploaded, when deleted) but the actual file is gone
5. Also delete from the Drive app folder if `drive_app_folder_file_id` is present on the attachment (fetch this field in the select query)

**No database changes needed** -- `document_attachment_history` already stores all the metadata fields without needing the actual file.

### Technical Detail

```typescript
// Replace renameGoogleDriveFile with:
async function deleteGoogleDriveFile(
  accessToken: string,
  fileId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
    // 204 = success, 404 = already gone (both are fine)
    if (!response.ok && response.status !== 404) {
      console.error('Google Drive delete error:', response.status)
      return false
    }
    return true
  } catch (error) {
    console.error('Failed to delete Drive file:', error)
    return false
  }
}
```

Single file edit + redeploy.

