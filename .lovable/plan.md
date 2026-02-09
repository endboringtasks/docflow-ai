

# Plan: Update Document Actions - Remove Delete, Always Show Download

## Overview

Based on the screenshot and requirements:
1. **Remove the delete (X) button** from current document attachments
2. **Keep the download button always visible** with "Download" text (not just an icon)
3. **Add the download button to rejected/historical documents** in the same style

## Current State

**Current Documents (ApplicationDetail.tsx lines 2400-2424):**
```
┌─ Attachment Row ─────────────────────────────────────────────┐
│ [Thumb] filename.pdf (1686 KB)  File     ...     ↓   ✕      │  <- Download (icon) + Delete shown on hover
└──────────────────────────────────────────────────────────────┘
```

**Historical/Rejected Documents (DocumentHistorySection.tsx lines 263-280):**
```
┌─ Entry ──────────────────────────────────────────────────────┐
│ ...content...                                                │
│   ↓ Download                                                 │  <- Download at bottom (only for non-drive files)
└──────────────────────────────────────────────────────────────┘
```

## Target State

**Current Documents:**
```
┌─ Attachment Row ─────────────────────────────────────────────┐
│ [Thumb] filename.pdf (1686 KB)  File     ...   ↓ Download   │  <- Always visible Download with text, NO delete
└──────────────────────────────────────────────────────────────┘
```

**Historical/Rejected Documents:**
```
┌─ File info row ──────────────────────────────────────────────┐
│ ● filename.pdf (86 KB)                ↓ Download   👁 View   │  <- Download next to View button
│   ...dates and rejection reason...                           │
└──────────────────────────────────────────────────────────────┘
```

## Changes

### File 1: `src/pages/migration/ApplicationDetail.tsx`

**Location:** Lines 2399-2425 (attachment actions section)

**Change:** 
1. Remove the opacity toggle (`opacity-0 group-hover:opacity-100`)
2. Remove the delete button (X icon)
3. Add "Download" text label to the download button

**Before:**
```tsx
<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
  <Button
    variant="ghost"
    size="icon"
    className="h-6 w-6 text-muted-foreground"
    onClick={() => handleDownloadFile(attachment.file_path, attachment.file_name)}
    title="Download"
  >
    <Download className="w-3 h-3" />
  </Button>
  <Button
    variant="ghost"
    size="icon"
    className="h-6 w-6 text-muted-foreground hover:text-destructive"
    onClick={() => setAttachmentToDelete({...})}
    disabled={removeAttachmentMutation.isPending}
    title="Remove"
  >
    <X className="w-3 h-3" />
  </Button>
</div>
```

**After:**
```tsx
<Button
  variant="ghost"
  size="sm"
  className="h-6 text-xs text-muted-foreground flex-shrink-0"
  onClick={() => handleDownloadFile(attachment.file_path, attachment.file_name)}
>
  <Download className="w-3 h-3 mr-1" />
  Download
</Button>
```

### File 2: `src/components/visa-application/DocumentHistorySection.tsx`

**Location:** Lines 207-234 (file info header row)

**Change:** Move the Download button from the bottom of the entry card to be next to the View button in the header row.

**Before:**
```tsx
{/* File info */}
<div className="flex items-start justify-between gap-2">
  <div className="flex items-center gap-2 min-w-0">
    <FileText ... />
    <span>filename</span>
    <span>(size)</span>
  </div>
  {/* View button only */}
  <Button onClick={handleViewDocument}>View</Button>
</div>

{/* Download at bottom */}
{!entry.file_path.startsWith("drive://") && (
  <div className="flex items-center gap-2 pt-1">
    <Button onClick={handleDownload}>Download</Button>
  </div>
)}
```

**After:**
```tsx
{/* File info */}
<div className="flex items-start justify-between gap-2">
  <div className="flex items-center gap-2 min-w-0">
    <FileText ... />
    <span>filename</span>
    <span>(size)</span>
  </div>
  {/* Download and View buttons together */}
  <div className="flex items-center gap-1 flex-shrink-0">
    {!entry.file_path.startsWith("drive://") && (
      <Button onClick={handleDownload}>
        <Download /> Download
      </Button>
    )}
    <Button onClick={handleViewDocument}>
      <Eye /> View
    </Button>
  </div>
</div>

{/* Remove bottom download section */}
```

## Visual Summary

| Element | Before | After |
|---------|--------|-------|
| Current doc delete button | Present (on hover) | **Removed** |
| Current doc download button | Icon only, hidden until hover | **Text + icon, always visible** |
| History doc download button | At bottom of entry | **In header row, next to View** |

## Files to Modify

| File | Lines | Changes |
|------|-------|---------|
| `src/pages/migration/ApplicationDetail.tsx` | 2399-2425 | Remove delete button, make download always visible with text |
| `src/components/visa-application/DocumentHistorySection.tsx` | 207-234, 263-281 | Move download to header row next to View button |

