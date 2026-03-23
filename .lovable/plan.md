

## Remove "Hide Comment" Toggle from DocumentPreviewDialog

### Change
In `src/components/visa-application/DocumentPreviewDialog.tsx`:

1. Remove the `showCommentInput` state variable
2. Always show the comment textarea (remove the conditional around it)
3. Remove the "Add Comment" / "Hide Comment" toggle button from the action bar
4. Keep the existing review comment display as-is

Single file change: `DocumentPreviewDialog.tsx`

