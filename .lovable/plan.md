
# Remove Checkbox from Document Checklist

## Summary

Remove the manual completion checkbox from the document checklist in the admin/migration view. The checkbox currently allows agents to manually toggle document completion status, but since completion is now tracked automatically based on file uploads and review status, this control is no longer needed.

## Current Behavior

Each document item in the checklist displays:
- A checkbox (circular appearance) to toggle completion
- Document name (with strikethrough when completed)
- Status badges (Pending Client, Ready to Review, Approved, Rejected)
- Action buttons (Preview, Upload, etc.)

## Proposed Change

Remove the checkbox element from the document list, keeping all other UI elements intact.

## File to Modify

| File | Change |
|------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | Remove the Checkbox component from lines 2066-2070 |

## Code Change

**Remove these lines (approximately 2066-2070):**
```typescript
<Checkbox
  checked={doc.completed}
  onCheckedChange={() => handleToggleDocument(doc.id, doc.completed)}
  disabled={toggleDocumentMutation.isPending}
/>
```

## Impact

- Document completion will rely solely on automated tracking (file uploads, review status)
- The `handleToggleDocument` function and `toggleDocumentMutation` can remain in code for now (cleanup optional)
- The strikethrough styling on document names will continue to work based on `doc.completed` value

## Visual Result

Before: `○ Previous Visas [Pending Client]`
After: `Previous Visas [Pending Client]`

Documents will still show their status badges and checkmarks will still appear when documents are completed, but users cannot manually toggle the status.
