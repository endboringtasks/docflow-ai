

# Plan: Rename Rejected Files in Google Drive

## Problem

When a rejected document is replaced with a new upload, the old file stays in Google Drive with the same name (e.g., `SANTOS_Anderson_Diploma.pdf`). The new replacement also gets the same name. This makes it impossible to distinguish rejected from current files in Google Drive.

## Solution

When archiving rejected attachments during a new upload, rename the old Google Drive files by prepending `REJECTED_` to their filename. For example:
- `SANTOS_Anderson_Diploma.pdf` becomes `REJECTED_SANTOS_Anderson_Diploma.pdf`

This applies to both upload paths:
1. **Client Portal Upload** (`client-portal-upload`) - which has the archival logic
2. **Internal Upload** (`internal-upload`) - which currently does not archive rejected docs but should for consistency (out of scope for now, as archival only happens via client portal)

## Changes Required

### File: `supabase/functions/client-portal-upload/index.ts`

#### Add a Google Drive rename helper function

After the existing `uploadToGoogleDrive` function (~line 153), add a new helper:

```typescript
async function renameGoogleDriveFile(
  accessToken: string,
  fileId: string,
  newName: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName }),
      }
    )
    return response.ok
  } catch (error) {
    console.error('Failed to rename Drive file:', error)
    return false
  }
}
```

#### Rename Drive files during archival (lines 393-443)

After archiving attachments to the history table and before deleting from `document_attachments`, rename each Google Drive file:

```typescript
// After successful archive (line 429), before deletion:
// Rename Google Drive files to indicate rejection
for (const att of existingAttachments) {
  if (att.file_path?.startsWith('drive://')) {
    const driveFileId = att.file_path.replace('drive://', '')
    const rejectedName = `REJECTED_${att.file_name}`
    console.log(`Renaming rejected Drive file ${driveFileId} to ${rejectedName}`)
    await renameGoogleDriveFile(accessToken, driveFileId, rejectedName)
  }
}
```

This requires the `accessToken` to be available at this point. The token is resolved later in the current flow, so we need to move the Google Drive token resolution earlier (before the archival block) or resolve it within the archival block specifically for rename purposes.

#### Ensure access token is available for rename

The Google Drive access token resolution currently happens around line 500+. We will need to resolve it earlier when archival is needed. We will add a conditional early token resolution:

```typescript
// Before archival block: get access token if we need to rename Drive files
let earlyAccessToken: string | null = null
if (currentReviewStatus === 'rejected') {
  // Check if any attachments are Drive files
  const { data: checkAtts } = await supabase
    .from('document_attachments')
    .select('file_path')
    .eq('document_checklist_id', docId)
    .like('file_path', 'drive://%')

  if (checkAtts && checkAtts.length > 0) {
    // Resolve access token early for rename
    earlyAccessToken = await getValidAccessToken(supabase, companyId)
  }
}
```

Then use `earlyAccessToken` in the rename loop.

### File: `supabase/functions/internal-upload/index.ts`

Add the same `renameGoogleDriveFile` helper function for future use and consistency. The internal upload does not currently handle rejected document archival, so no rename logic is needed yet -- but having the helper available makes it easy to add later.

## Visual Result in Google Drive

**Before:**
```
SANTOS_Anderson_Diploma.jpeg    (rejected - unclear)
SANTOS_Anderson_Diploma.pdf     (rejected - unclear)  
SANTOS_Anderson_Diploma.pdf     (rejected - unclear)
SANTOS_Anderson_Diploma.png     (current - unclear)
```

**After:**
```
REJECTED_SANTOS_Anderson_Diploma.jpeg    (clearly rejected)
REJECTED_SANTOS_Anderson_Diploma.pdf     (clearly rejected)
REJECTED_SANTOS_Anderson_Diploma.pdf     (clearly rejected)
SANTOS_Anderson_Diploma.png              (clearly current)
```

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/client-portal-upload/index.ts` | Add `renameGoogleDriveFile` helper, add early access token resolution, rename Drive files during archival |
| `supabase/functions/internal-upload/index.ts` | Add `renameGoogleDriveFile` helper for future use |

## Edge Cases

- **Non-Drive files** (Supabase Storage): File path does not start with `drive://`, so rename is skipped. These files are only referenced by path in the database, and renaming Supabase storage files is not straightforward -- but these are rarely used when Drive is connected.
- **Token refresh failure**: If the access token cannot be resolved, the rename is skipped silently (logged as warning). The upload and archival still proceed normally.
- **API rate limits**: Google Drive API has generous limits; renaming a few files during archival should not hit any limits.
