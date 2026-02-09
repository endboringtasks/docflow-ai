
# Plan: Display Document History on Application Detail Page

## Summary
Move the document version history from the preview dialog to be displayed inline on the Application Detail page. Also remove the review comment that currently appears below the attachments on each document card.

## Changes Overview

### 1. Add Document History Section to Each Document Card

**File: `src/pages/migration/ApplicationDetail.tsx`**

For each document that has history entries, display the `DocumentHistorySection` component directly below the attachments list. This will show the timeline of rejected/archived documents inline on the page.

**Location**: After the attachments list section (around line 2319-2325)

**Add:**
```tsx
{/* Document History - show inline if history exists */}
{documentHistoryByDoc?.[doc.id] && documentHistoryByDoc[doc.id].length > 0 && (
  <div className="mt-2 ml-8">
    <DocumentHistorySection
      history={documentHistoryByDoc[doc.id] as DocumentHistoryEntry[]}
      companyId={visaApplication?.company_id}
      inline={false}  // Use collapsible mode to save space
    />
  </div>
)}
```

### 2. Remove Review Comment Display

**File: `src/pages/migration/ApplicationDetail.tsx`**

Remove the review comment text that appears below attachments. Currently at two places:

**Location 1** (lines 2320-2324): Remove this block
```tsx
{doc.reviewComment && (
  <p className="text-sm text-muted-foreground italic pl-1">
    "{doc.reviewComment}"
  </p>
)}
```

**Location 2** (lines 2338-2342): Remove this block as well (for legacy single file display)
```tsx
{doc.reviewComment && (
  <p className="text-sm text-muted-foreground italic pl-1">
    "{doc.reviewComment}"
  </p>
)}
```

### 3. Keep History in Preview Dialog (Optional Enhancement)

The history tab in the preview dialog can remain for detailed viewing, but it's now also visible on the main page for quick reference.

## Visual Result

**Before:**
```
┌─ Diploma ────────────────────────────────────────────────┐
│  📄 Screenshot 2025-12-17.png (1686 KB)                  │
│  "need to be another document"   <-- REMOVE THIS         │
└──────────────────────────────────────────────────────────┘
```

**After:**
```
┌─ Diploma ────────────────────────────────────────────────┐
│  📄 Screenshot 2025-12-17.png (1686 KB)                  │
│                                                          │
│  > Previous Versions (2)  [collapsed by default]         │
│    ├─ Version 2 - Rejected Feb 9 "too blurry"           │
│    └─ Version 1 - Rejected Feb 7 "wrong type"           │
└──────────────────────────────────────────────────────────┘
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/migration/ApplicationDetail.tsx` | 1. Import `DocumentHistorySection` (already imported)<br>2. Add history section after attachments<br>3. Remove review comment displays (2 locations) |

## Technical Notes

- The `documentHistoryByDoc` query is already available in the component - it fetches history grouped by document ID
- `DocumentHistorySection` component already supports the `inline` prop for direct display or collapsible mode
- Using `inline={false}` (collapsible mode) to keep the page compact while still showing history is available
- The review comment remains visible within the history entries themselves (where it shows the rejection reason)
