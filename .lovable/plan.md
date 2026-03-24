

## Fix: Document History Not Updating in Real-Time

### Problem
When a client uploads and deletes a file, the new history entry doesn't appear on the Application Detail page until a manual refresh. The realtime subscription listens to `document_checklist` and `document_attachments` tables, but **not** `document_attachment_history`. When the edge function archives a deleted file to history, no realtime event triggers a re-fetch of the history query.

Although the `document_checklist` change does trigger invalidation of `["document-history", visaApplicationId]`, React Query may serve stale data if the invalidation races with the history insert (the checklist update and history insert happen in the same edge function call, but the realtime event for checklist may fire before the history row is committed).

### Solution
Add a realtime subscription for the `document_attachment_history` table to the existing channel in `ApplicationDetail.tsx`.

### Change

**File: `src/pages/migration/ApplicationDetail.tsx` (~line 1055, before `.subscribe()`)**

Add a third `.on()` listener to the existing channel:

```typescript
.on(
  "postgres_changes",
  {
    event: "INSERT",
    schema: "public",
    table: "document_attachment_history",
  },
  (payload) => {
    const checklistId = (payload.new as any)?.document_checklist_id;
    if (checklistId && docIdsForHistory.includes(checklistId)) {
      queryClient.invalidateQueries({ queryKey: ["document-history", visaApplicationId] });
    }
  }
)
```

This ensures that whenever a new history record is inserted (from upload-then-delete or rejection archiving), the history query is immediately re-fetched.

**Note**: The `document_attachment_history` table must have realtime enabled in Supabase. If not already enabled, a migration or Supabase dashboard toggle will be needed.
