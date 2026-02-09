

# Plan: Reposition "View" Button in Document History to Match Current Documents

## Issue Summary
The "View" button for rejected/historical documents is positioned at the **bottom left** of each entry card, while the current document's "View" button is at the **top right** of the header. This creates visual inconsistency.

| Element | Current Position | Expected Position |
|---------|-----------------|-------------------|
| Current document View button | Top right of header row | ✓ (keep as is) |
| Historical document View button | Bottom left of entry card | Top right of entry card (same row as file name) |

## Solution

Move the "View" button in `DocumentHistorySection.tsx` from the Actions section at the bottom to the file info header row at the top.

## Changes

### File: `src/components/visa-application/DocumentHistorySection.tsx`

**Current structure (simplified):**
```
┌─ Entry Card ─────────────────────────────────────────────┐
│ ● file_name.pdf (size)                                   │  <- file info row
│   📅 Uploaded...  ⊗ Rejected...                          │  <- dates row
│   "rejection reason"                                     │  <- reason
│   👁 View  📥 Download                                    │  <- actions (BOTTOM)
└──────────────────────────────────────────────────────────┘
```

**After change:**
```
┌─ Entry Card ─────────────────────────────────────────────┐
│ ● file_name.pdf (size)                     👁 View       │  <- file info + View
│   📅 Uploaded...  ⊗ Rejected...                          │  <- dates row
│   "rejection reason"                                     │  <- reason
│   📥 Download                                            │  <- download only
└──────────────────────────────────────────────────────────┘
```

**Location:** Lines 202-215 (file info section) and Lines 239-254 (actions section)

**Change 1:** Add View button to file info header row (line 203-215)

Move from:
```tsx
{/* File info */}
<div className="flex items-start justify-between gap-2">
  <div className="flex items-center gap-2 min-w-0">
    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    <span className="text-sm font-medium truncate line-through text-muted-foreground">
      {entry.file_name}
    </span>
    {entry.file_size && (
      <span className="text-xs text-muted-foreground/70 flex-shrink-0">
        ({formatFileSize(entry.file_size)})
      </span>
    )}
  </div>
</div>
```

To:
```tsx
{/* File info */}
<div className="flex items-start justify-between gap-2">
  <div className="flex items-center gap-2 min-w-0">
    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    <span className="text-sm font-medium truncate line-through text-muted-foreground">
      {entry.file_name}
    </span>
    {entry.file_size && (
      <span className="text-xs text-muted-foreground/70 flex-shrink-0">
        ({formatFileSize(entry.file_size)})
      </span>
    )}
  </div>
  {/* View button - same position as current documents */}
  <Button
    variant="ghost"
    size="sm"
    className="h-7 text-xs text-primary flex-shrink-0"
    onClick={() => handleViewDocument(entry)}
    disabled={loadingId === entry.id}
  >
    {loadingId === entry.id ? (
      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
    ) : (
      <Eye className="w-3 h-3 mr-1" />
    )}
    View
  </Button>
</div>
```

**Change 2:** Remove View button from Actions section (lines 239-254)

The Actions section will only contain the Download button:
```tsx
{/* Actions - Download only */}
{!entry.file_path.startsWith("drive://") && (
  <div className="flex items-center gap-2 pt-1">
    <Button
      variant="ghost"
      size="sm"
      className="h-7 text-xs"
      onClick={() => handleDownload(entry)}
      disabled={loadingId === entry.id}
    >
      {loadingId === entry.id ? (
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
      ) : (
        <Download className="w-3 h-3 mr-1" />
      )}
      Download
    </Button>
  </div>
)}
```

## Visual Result

**Before:**
```
Diploma [Ready to Review]      📅 Uploaded 2/9/26...     👁 View
  📄 Screenshot 2025-12-17.png (1686 KB)
  
  ● Anderson_Plan.pdf (45 KB)
     📅 Uploaded...  ⊗ Rejected...
     "need to be another document"
     👁 View  📥 Download     <- View at bottom
```

**After:**
```
Diploma [Ready to Review]      📅 Uploaded 2/9/26...     👁 View
  📄 Screenshot 2025-12-17.png (1686 KB)
  
  ● Anderson_Plan.pdf (45 KB)                            👁 View  <- View at top right
     📅 Uploaded...  ⊗ Rejected...
     "need to be another document"
     📥 Download               <- Only download at bottom
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/visa-application/DocumentHistorySection.tsx` | 1. Add View button to file info header row (lines 203-215)<br>2. Remove View button from Actions section (lines 241-254)<br>3. Conditionally render Actions section only when Download is available |

