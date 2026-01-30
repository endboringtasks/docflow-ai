

# Add Confirmation Dialog for Client Portal File Removal

## Summary

Add a confirmation dialog when users click the "X" button to remove a file in the Client Portal, matching the behavior just implemented in the Application page. This prevents accidental file deletions and warns users about permanent deletion.

## Current Behavior

When clicking the X button on an attachment in the Client Portal:
- The file is immediately deleted without confirmation
- No warning about permanent deletion is shown

## Proposed Solution

Add an AlertDialog confirmation that:
1. Warns the user the action will permanently delete the file
2. Shows the file name being deleted
3. Requires explicit confirmation before proceeding

## File to Modify

| File | Change |
|------|--------|
| `src/pages/client-portal/ClientPortal.tsx` | Add state for tracking attachment to delete, add AlertDialog, update X button click handler |

## Implementation Details

**1. Add new state variable (after line 175):**
```typescript
const [attachmentToDelete, setAttachmentToDelete] = useState<{
  id: string;
  fileName: string;
} | null>(null);
```

**2. Update X button click handler (line 1250):**

Change from immediate function call:
```typescript
onClick={() => handleRemoveAttachment(attachment.id)}
```

To opening the confirmation dialog:
```typescript
onClick={() => setAttachmentToDelete({
  id: attachment.id,
  fileName: attachment.file_name
})}
```

**3. Create handler for confirmed deletion:**
```typescript
const handleConfirmRemoveAttachment = async () => {
  if (!attachmentToDelete) return;
  await handleRemoveAttachment(attachmentToDelete.id);
  setAttachmentToDelete(null);
};
```

**4. Add AlertDialog (after the Image Preview Dialog, around line 1356):**

```typescript
{/* Delete Attachment Confirmation */}
<AlertDialog 
  open={!!attachmentToDelete} 
  onOpenChange={(open) => !open && setAttachmentToDelete(null)}
>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete File</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to delete "{attachmentToDelete?.fileName}"? 
        This file will be permanently deleted and cannot be recovered.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={!!removingAttachmentId}>Cancel</AlertDialogCancel>
      <AlertDialogAction
        onClick={handleConfirmRemoveAttachment}
        disabled={!!removingAttachmentId}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        {removingAttachmentId === attachmentToDelete?.id ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Deleting...
          </>
        ) : (
          "Delete"
        )}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## User Experience

**Before:**
- Click X button -> File deleted immediately

**After:**
- Click X button -> Confirmation dialog appears
- Dialog shows: "Are you sure you want to delete 'passport.pdf'? This file will be permanently deleted and cannot be recovered."
- User clicks Cancel -> Dialog closes, nothing happens
- User clicks Delete -> File is deleted, dialog closes

## Visual Consistency

The confirmation dialog follows the same pattern used in:
- The Submit Application confirmation in this same file
- The Delete Attachment confirmation in ApplicationDetail.tsx (just implemented)

