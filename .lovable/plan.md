

## Remove "Request Different Doc" Button

**File: `src/components/visa-application/DocumentPreviewDialog.tsx`**

1. Remove the "Request Different Doc" button (lines ~289-301) from the action buttons section
2. Remove the `onRequestNewDocument` prop and its handler function `handleRequestNew` since they're no longer needed
3. Clean up the prop interface

