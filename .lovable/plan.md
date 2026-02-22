

## Clean Up Dead Code in ApplicationDetail.tsx

Remove unused delete-attachment code since the delete button was already removed from the UI.

### Changes

**File: `src/pages/migration/ApplicationDetail.tsx`**

Remove three pieces of dead code:

1. **State declaration** (lines 326-331): Remove the `attachmentToDelete` state
2. **Mutation** (lines 1330-1371): Remove the entire `removeAttachmentMutation` 
3. **AlertDialog** (lines 2911-2951): Remove the delete confirmation dialog JSX

No other files reference `attachmentToDelete` or `removeAttachmentMutation`, so these are safe to remove with no side effects.

