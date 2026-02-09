

# Plan: Move Download Button Next to View Button for Current Documents

## Current Layout

Based on the screenshot:
```
┌─ Document Header ────────────────────────────────────────────────────────────┐
│ Diploma [Original] [Ready to Review]  Uploaded...  Reviewed...        [View] │
└──────────────────────────────────────────────────────────────────────────────┘
│ Screenshot 2025-12-17... (1686 KB) [File]                          [Download]│
└──────────────────────────────────────────────────────────────────────────────┘
```

The "View" button is in the header row (line 2311-2319), while "Download" is on the attachment row (line 2400-2408).

## Target Layout

Match the rejected documents layout where Download comes before View:
```
┌─ Document Header ────────────────────────────────────────────────────────────┐
│ Diploma [Original] [Ready to Review]  Uploaded...  [Download] [View]         │
└──────────────────────────────────────────────────────────────────────────────┘
│ Screenshot 2025-12-17... (1686 KB) [File]                                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Changes Required

### File: `src/pages/migration/ApplicationDetail.tsx`

#### Change 1: Add Download button before View button in header (lines 2308-2320)

**Current code (View button only):**
```tsx
<div className="flex items-center gap-2">
  {/* File actions */}
  {doc.attachmentCount > 0 && (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 text-xs text-primary"
      onClick={() => setPreviewDoc(doc)}
    >
      <Eye className="w-3 h-3 mr-1" />
      View
    </Button>
  )}
```

**New code (Download + View):**
```tsx
<div className="flex items-center gap-2">
  {/* File actions */}
  {doc.attachmentCount > 0 && doc.attachments?.[0] && (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 text-xs text-muted-foreground"
      onClick={() => handleDownloadFile(doc.attachments[0].file_path, doc.attachments[0].file_name)}
    >
      <Download className="w-3 h-3 mr-1" />
      Download
    </Button>
  )}
  {doc.attachmentCount > 0 && (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 text-xs text-primary"
      onClick={() => setPreviewDoc(doc)}
    >
      <Eye className="w-3 h-3 mr-1" />
      View
    </Button>
  )}
```

#### Change 2: Remove Download button from attachment row (lines 2400-2408)

Remove the Download button from the individual attachment display since it's now in the header.

## Visual Result

**Before:**
```
Diploma [badges]  Uploaded...  Reviewed...                              [View]
  Screenshot.png (1686 KB) [File]                                    [Download]
```

**After (matching rejected documents):**
```
Diploma [badges]  Uploaded...  Reviewed...              [Download]      [View]
  Screenshot.png (1686 KB) [File]
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/migration/ApplicationDetail.tsx` | Add Download button before View in header row (lines 2308-2320), remove Download from attachment row (lines 2400-2408) |

