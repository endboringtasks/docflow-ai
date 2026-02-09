

# Plan: Fix History Tab Display and Document Preview

## Issues Identified

### 1. Collapsible "Previous Versions" Header
The History tab currently shows an unnecessary "Previous Versions" collapsible header that must be clicked to expand. Since we're already on the History tab, documents should be visible immediately.

### 2. View Button Opens New Tab
When clicking "View" on a historical document, it opens in a new browser tab instead of showing the preview within the dialog (like the current document preview).

## Technical Solution

### File 1: `src/components/visa-application/DocumentHistorySection.tsx`

**Change:** Add a new prop `defaultOpen` that controls whether the collapsible is expanded by default, OR add an `inline` mode that skips the collapsible wrapper entirely.

I recommend adding an `inline` prop for cleaner implementation:

```typescript
interface DocumentHistorySectionProps {
  history: DocumentHistoryEntry[];
  onViewDocument?: (url: string, fileName: string) => void;
  companyId?: string;
  isClientPortal?: boolean;
  portalToken?: string;
  inline?: boolean; // NEW: When true, show documents directly without collapsible
}
```

When `inline={true}`:
- Skip the Collapsible wrapper entirely
- Render the timeline of documents directly
- Still use the same styling for individual entries

### File 2: `src/components/visa-application/DocumentPreviewDialog.tsx`

**Changes:**

1. **Add state for viewing historical documents:**
   ```typescript
   const [historyPreview, setHistoryPreview] = useState<{url: string, name: string} | null>(null);
   ```

2. **Pass `onViewDocument` callback to DocumentHistorySection:**
   ```typescript
   <DocumentHistorySection
     history={documentHistory}
     companyId={companyId}
     inline={true}  // NEW: Remove collapsible header
     onViewDocument={(url, name) => setHistoryPreview({url, name})}  // NEW: Handle in-dialog preview
   />
   ```

3. **Add preview area for historical documents in History tab:**
   - When a historical document is selected, show the preview inline (image or PDF iframe)
   - Include back button to return to history list
   - Use same zoom/rotation controls as main preview

## Visual Layout for History Tab

**Before (current):**
```
[History Tab]
> Previous Versions (3)  [click to expand]
   └─ Document 1
   └─ Document 2
   └─ Document 3
```

**After:**
```
[History Tab]
┌─────────────────────────────┐
│ ● Document 1 (rejected)     │  <- Always visible
│   "rejection reason"        │
│   [View] [Download]         │
├─────────────────────────────┤
│ ● Document 2 (rejected)     │
│   "rejection reason"        │
│   [View] [Download]         │
├─────────────────────────────┤
│ ● Document 3 (rejected)     │
│   "rejection reason"        │
│   [View] [Download]         │
└─────────────────────────────┘
```

**When View is clicked:**
```
[History Tab]
┌─────────────────────────────┐
│ ← Back to History           │
│ Viewing: document1.pdf      │
├─────────────────────────────┤
│ [Zoom controls]             │
│ ┌─────────────────────────┐ │
│ │                         │ │
│ │   [Document Preview]    │ │
│ │                         │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/visa-application/DocumentHistorySection.tsx` | Add `inline` prop to skip collapsible wrapper |
| `src/components/visa-application/DocumentPreviewDialog.tsx` | Pass `inline={true}` and `onViewDocument` callback; add inline preview for historical documents |

## Implementation Details

### DocumentHistorySection.tsx Changes

1. Add `inline` prop to interface
2. Conditionally render:
   - If `inline={true}`: Render timeline directly without Collapsible wrapper
   - If `inline={false}` (default): Keep existing collapsible behavior for Client Portal use

### DocumentPreviewDialog.tsx Changes

1. Add `historyPreview` state to track which historical doc is being previewed
2. In History tab:
   - If `historyPreview` is null: Show document list with `inline={true}`
   - If `historyPreview` is set: Show preview with back button
3. Preview uses same image/PDF rendering logic as current document tab

