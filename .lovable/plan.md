

# Plan: Enhance History Document Preview Dialog Consistency

## Current Behavior

The ApplicationDetail page has two ways to view historical documents:

1. **Via DocumentPreviewDialog** (clicking View on main document, then History tab):
   - Shows full preview with "Back to History" navigation
   - Has zoom controls (ZoomIn, ZoomOut, Rotate)
   - Rich UI with document name display

2. **Via inline DocumentHistorySection** (clicking View on rejected docs directly on page):
   - Opens a simpler dialog (lines 2848-2905)
   - No zoom controls
   - Basic preview only

## Problem

When clicking "View" on rejected documents from the inline history section, users get a simpler dialog instead of the rich preview experience shown in the screenshot.

## Solution

Enhance the History Document Preview Dialog in ApplicationDetail.tsx to match the DocumentPreviewDialog's history preview experience:
- Add zoom controls (ZoomIn, ZoomOut, Rotate for images)
- Add consistent header styling
- Include download button

## Changes Required

### File: `src/pages/migration/ApplicationDetail.tsx`

**Add new state variables** (after line 329):
```tsx
const [historyZoom, setHistoryZoom] = useState(1);
const [historyRotation, setHistoryRotation] = useState(0);
```

**Reset zoom/rotation when historyPreview changes** (in useEffect or when setting):
```tsx
// When setting historyPreview, also reset zoom/rotation
const openHistoryPreview = (url: string, name: string) => {
  setHistoryPreview({ url, name });
  setHistoryZoom(1);
  setHistoryRotation(0);
};
```

**Update the onViewDocument callback** (lines 2421, 2445):
```tsx
onViewDocument={(url, fileName) => {
  setHistoryPreview({ url, name: fileName });
  setHistoryZoom(1);
  setHistoryRotation(0);
}}
```

**Enhance the History Document Preview Dialog** (lines 2848-2905):

```tsx
{/* History Document Preview Dialog */}
<Dialog open={!!historyPreview} onOpenChange={(open) => {
  if (!open) {
    setHistoryPreview(null);
    setHistoryZoom(1);
    setHistoryRotation(0);
  }
}}>
  <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
    <DialogHeader className="flex-shrink-0">
      <DialogTitle className="text-sm font-medium truncate">
        {historyPreview?.name}
      </DialogTitle>
      <DialogDescription className="text-xs text-muted-foreground">
        Archived document preview
      </DialogDescription>
    </DialogHeader>
    
    {/* Zoom Controls - matches DocumentPreviewDialog */}
    <div className="flex items-center justify-between bg-secondary/50 rounded-lg p-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setHistoryZoom(Math.max(0.25, historyZoom - 0.25))} disabled={historyZoom <= 0.25}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium w-16 text-center">{Math.round(historyZoom * 100)}%</span>
        <Button variant="ghost" size="icon" onClick={() => setHistoryZoom(Math.min(3, historyZoom + 0.25))} disabled={historyZoom >= 3}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        {/* Rotate for images */}
        {historyPreview?.name.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) && (
          <Button variant="ghost" size="icon" onClick={() => setHistoryRotation((historyRotation + 90) % 360)}>
            <RotateCw className="w-4 h-4" />
          </Button>
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={() => {
        if (historyPreview?.url) {
          const link = document.createElement('a');
          link.href = historyPreview.url;
          link.download = historyPreview.name;
          link.click();
        }
      }}>
        <Download className="w-4 h-4 mr-2" />
        Download
      </Button>
    </div>
    
    {/* Preview Content with zoom/rotation */}
    <div className="flex-1 min-h-0 overflow-auto bg-secondary/30 rounded-lg flex items-center justify-center p-4">
      {/* Image with zoom/rotation */}
      {isImage && <img style={{ transform: `scale(${historyZoom}) rotate(${historyRotation}deg)` }} ... />}
      {/* PDF with zoom */}
      {isPdf && <iframe style={{ transform: `scale(${historyZoom})` }} ... />}
    </div>
  </DialogContent>
</Dialog>
```

## Visual Result

**Before** (simple dialog):
```
┌─────────────────────────────────────┐
│ Anderson_Plan.pdf                   │
│ Archived document preview           │
├─────────────────────────────────────┤
│                                     │
│         [PDF Preview]               │
│                                     │
└─────────────────────────────────────┘
```

**After** (matches DocumentPreviewDialog):
```
┌─────────────────────────────────────┐
│ Anderson_Plan.pdf                   │
│ Archived document preview           │
├─────────────────────────────────────┤
│ [-] 100% [+]              [Download]│
├─────────────────────────────────────┤
│                                     │
│         [PDF Preview]               │
│          (zoomable)                 │
└─────────────────────────────────────┘
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/migration/ApplicationDetail.tsx` | Add historyZoom/historyRotation state, add zoom controls and download button to history preview dialog, apply transform to preview content |

## Required Imports

Add to existing imports (line 37):
- `ZoomIn`, `ZoomOut`, `RotateCw` from lucide-react (already has `Download`)

