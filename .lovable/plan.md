

# Plan: Fix Document History Display on Application Detail Page

## Issues to Fix

1. **View button opens new browser tab** - The `onViewDocument` callback is not being passed, so the component falls back to `window.open(signedUrl, "_blank")`
2. **"Previous Versions" text still showing** - Using `inline={false}` which renders the collapsible header

## Solution

### File: `src/pages/migration/ApplicationDetail.tsx`

**Change 1:** Update both instances of `DocumentHistorySection` to use `inline={true}` to remove the collapsible header and show history directly.

**Change 2:** Pass an `onViewDocument` callback that opens the document in the existing preview dialog instead of a new browser tab.

**Location 1** (around line 2321-2328):
```tsx
{/* Document History - inline on page */}
{documentHistoryByDoc?.[doc.id] && (documentHistoryByDoc[doc.id] as DocumentHistoryEntry[]).length > 0 && (
  <div className="mt-2">
    <DocumentHistorySection
      history={documentHistoryByDoc[doc.id] as DocumentHistoryEntry[]}
      companyId={visaApplication?.company_id}
      inline={true}  // Changed from false to true
      onViewDocument={(url, fileName) => {
        // Open in preview dialog using existing previewDoc state
        setPreviewDoc({
          ...doc,
          previewUrl: url,
          fileName: fileName,
        });
      }}
    />
  </div>
)}
```

**Location 2** (around line 2344-2351) - same changes for legacy single file display:
```tsx
{/* Document History - inline on page for legacy files */}
{documentHistoryByDoc?.[doc.id] && (documentHistoryByDoc[doc.id] as DocumentHistoryEntry[]).length > 0 && (
  <div className="mt-2">
    <DocumentHistorySection
      history={documentHistoryByDoc[doc.id] as DocumentHistoryEntry[]}
      companyId={visaApplication?.company_id}
      inline={true}  // Changed from false to true
      onViewDocument={(url, fileName) => {
        setPreviewDoc({
          ...doc,
          previewUrl: url,
          fileName: fileName,
        });
      }}
    />
  </div>
)}
```

## Visual Result

**Before:**
```
📄 current-document.pdf
> Previous Versions (2)  [click to expand, view opens new tab]
```

**After:**
```
📄 current-document.pdf
● rejected-doc-1.pdf [Rejected Feb 9] "reason"  [View opens in dialog]
● rejected-doc-2.pdf [Rejected Feb 7] "reason"  [View opens in dialog]
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/migration/ApplicationDetail.tsx` | 1. Change `inline={false}` to `inline={true}` (2 locations)<br>2. Add `onViewDocument` callback that uses `setPreviewDoc` (2 locations) |

## Technical Notes

- The `previewDoc` state and `setPreviewDoc` function already exist in the component for opening documents in the preview dialog
- By passing a custom `previewUrl` and `fileName`, we can make the preview dialog show the historical document
- The `inline={true}` prop already removes the collapsible wrapper and shows documents directly

