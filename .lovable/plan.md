
# Plan: Enable Download for Google Drive Files in Document History

## Problem Identified

The rejected documents in history that are stored on Google Drive (file paths starting with `drive://`) don't show the "Download" button. This is because:

1. **Button visibility**: Line 221 has `{!entry.file_path.startsWith("drive://") && (...)}` which hides the Download button for Google Drive files
2. **Download logic**: The `handleDownload` function (line 153) only handles Supabase storage files, not Google Drive files

## Root Cause Analysis

| File Type | file_path | Download Button | Why |
|-----------|-----------|-----------------|-----|
| Supabase Storage | `company_123/file.pdf` | ✅ Shows | Condition passes |
| Google Drive | `drive://1EZRJQce_...` | ❌ Hidden | Condition `!startsWith("drive://")` fails |

## Solution

Update `DocumentHistorySection.tsx` to:
1. **Always show the Download button** (remove the `drive://` exclusion condition)
2. **Add Google Drive download handling** in `handleDownload` function using the existing `get-drive-file-url` edge function

## Changes Required

### File: `src/components/visa-application/DocumentHistorySection.tsx`

#### Change 1: Update `handleDownload` function (lines 130-176)
Add a new branch to handle Google Drive files, similar to how `handleViewDocument` handles them:

```tsx
const handleDownload = async (entry: DocumentHistoryEntry) => {
  setLoadingId(entry.id);
  try {
    let signedUrl: string | null = null;

    if (isClientPortal && portalToken) {
      // Client portal flow (unchanged)
      ...
    } else if (entry.file_path.startsWith("drive://") && companyId) {
      // Google Drive file - get download URL
      const fileId = entry.file_path.replace("drive://", "");
      const { data, error } = await supabase.functions.invoke(
        "get-drive-file-url",
        { body: { file_id: fileId, company_id: companyId } }
      );
      if (error) throw error;
      // Use webContentLink for direct download
      signedUrl = data?.file?.webContentLink || data?.file?.webViewLink;
    } else {
      // Supabase storage file (unchanged)
      ...
    }
    
    // Download logic (unchanged)
    ...
  }
};
```

#### Change 2: Remove Download button visibility restriction (lines 219-236)
Remove the condition that hides Download for Google Drive files:

**Before:**
```tsx
<div className="flex items-center gap-1 flex-shrink-0">
  {!entry.file_path.startsWith("drive://") && (
    <Button onClick={() => handleDownload(entry)}>
      Download
    </Button>
  )}
  <Button onClick={() => handleViewDocument(entry)}>View</Button>
</div>
```

**After:**
```tsx
<div className="flex items-center gap-1 flex-shrink-0">
  <Button onClick={() => handleDownload(entry)}>
    Download
  </Button>
  <Button onClick={() => handleViewDocument(entry)}>View</Button>
</div>
```

## Visual Result

**Before (Google Drive files in history):**
```
● Anderson_Plan.pdf (86 KB)                           [View]
```

**After:**
```
● Anderson_Plan.pdf (86 KB)              [Download]   [View]
```

## Technical Details

The `get-drive-file-url` edge function already exists and returns:
- `webContentLink` - Direct download link (preferred for downloads)
- `webViewLink` - Opens in Google Drive viewer (fallback)
- `previewUrl` - Base64 data URL for preview (used by View)

For downloads, we'll prioritize `webContentLink` which triggers a direct file download.

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/visa-application/DocumentHistorySection.tsx` | Add Google Drive support to handleDownload, remove button visibility condition |
