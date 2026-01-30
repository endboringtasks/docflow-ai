

# Add Confirmation Dialog for Attachment Deletion

## Summary

Add a confirmation dialog when users click the "X" button to remove a document attachment. This ensures users are warned that the file will be permanently deleted before proceeding.

## Current Behavior

When clicking the X button on an attachment:
- The file is immediately deleted without confirmation
- No warning about permanent deletion is shown

## Proposed Solution

Add an AlertDialog confirmation that:
1. Warns the user the action will permanently delete the file
2. Shows the file name being deleted
3. Requires explicit confirmation before proceeding

## Changes Required

### File to Modify

| File | Change |
|------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | Add state for tracking attachment to delete, add AlertDialog, update X button click handler |

### Implementation Details

**1. Add new state variable (after line 318):**
```typescript
const [attachmentToDelete, setAttachmentToDelete] = useState<{
  id: string;
  docId: string;
  filePath: string;
  fileName: string;
} | null>(null);
```

**2. Update X button click handler (around line 2284):**

Change from immediate mutation call:
```typescript
onClick={() => removeAttachmentMutation.mutate({ 
  attachmentId: attachment.id, 
  docId: doc.id, 
  filePath: attachment.file_path 
})}
```

To opening the confirmation dialog:
```typescript
onClick={() => setAttachmentToDelete({
  id: attachment.id,
  docId: doc.id,
  filePath: attachment.file_path,
  fileName: attachment.file_name
})}
```

**3. Add AlertDialog (after the Merge Templates AlertDialog, around line 2653):**

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
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        onClick={() => {
          if (attachmentToDelete) {
            removeAttachmentMutation.mutate({
              attachmentId: attachmentToDelete.id,
              docId: attachmentToDelete.docId,
              filePath: attachmentToDelete.filePath
            });
            setAttachmentToDelete(null);
          }
        }}
        disabled={removeAttachmentMutation.isPending}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        {removeAttachmentMutation.isPending ? (
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
- Click X button → File deleted immediately

**After:**
- Click X button → Confirmation dialog appears
- Dialog shows: "Are you sure you want to delete 'passport.pdf'? This file will be permanently deleted and cannot be recovered."
- User clicks Cancel → Dialog closes, nothing happens
- User clicks Delete → File is deleted, dialog closes

## Visual Consistency

The confirmation dialog follows the same pattern already used in the application for:
- Delete Application confirmation
- Merge Templates confirmation
- Delete Client confirmation (in other pages)

