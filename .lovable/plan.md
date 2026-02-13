
# Plan: Archive Deleted Documents and Preserve Review Status

## Problem
When a client deletes an uploaded document in the client portal:
1. The document card doesn't return to the correct color because the edge function resets `review_status` to `'pending'` instead of preserving the previous status (e.g., `'pending_client'`)
2. The deleted file is permanently removed without being archived to the history table, so agents have no record of what was deleted

## Changes

### 1. Edge Function: `supabase/functions/client-portal-remove-document/index.ts`

**Archive before deleting**: Before removing the attachment record, insert it into `document_attachment_history` with `archived_reason: 'client_deleted'`. This mirrors the existing pattern used in `client-portal-upload` for rejected documents.

**Preserve review status**: When updating the document checklist after deletion:
- If the previous `review_status` was `'pending_client'`, keep it as `'pending_client'` (the agent requested a document and the client removed it -- it's still pending from the client)
- Only use `'in_review'` or `'pending'` for documents that weren't in a special review state

**Specifically, in the attachment removal flow (around lines 104-163):**
- After fetching the attachment data but before deleting the record, insert a row into `document_attachment_history` with:
  - All attachment fields (file_path, file_name, file_type, file_size, uploaded_at, uploaded_by, uploaded_by_client)
  - `archived_reason: 'client_deleted'`
  - `review_status_at_archive` from the current document checklist status
- Update the review_status logic: if previous status was `'pending_client'`, preserve it; otherwise use the current logic (`isCompleted ? 'in_review' : 'pending'`)

### 2. Edge Function: Legacy flow (doc_id removal, around lines 195-260)
- Same archival pattern: archive all attachments to history with `archived_reason: 'client_deleted'` before deleting them
- Preserve `pending_client` status if that was the previous state

## No UI Changes Needed
The client portal already uses `refreshDocuments()` after deletion, which re-fetches from the database. Once the edge function correctly preserves the `review_status`, the card colors will automatically reflect the right state (amber for `pending_client`).

## Technical Details

### New history record shape
```ts
{
  document_checklist_id: documentChecklistId,
  file_path: attachment.file_path,
  file_name: attachment.file_name,
  file_type: attachment.file_type,
  file_size: attachment.file_size,
  uploaded_at: attachment.uploaded_at,
  uploaded_by: attachment.uploaded_by,
  uploaded_by_client: attachment.uploaded_by_client,
  archived_reason: 'client_deleted',
  review_status_at_archive: docChecklist.review_status,
}
```

### Status preservation logic
```ts
// Determine new review_status
const previousStatus = docChecklist?.review_status
let newReviewStatus: string
if (previousStatus === 'pending_client') {
  newReviewStatus = 'pending_client'  // Agent requested doc, keep pending
} else {
  newReviewStatus = isCompleted ? 'in_review' : 'pending'
}
```

### Files to modify

| File | Change |
|------|--------|
| `supabase/functions/client-portal-remove-document/index.ts` | Archive attachments to history before deletion; preserve `pending_client` status |

### Edge function to deploy
- `client-portal-remove-document`

### Additional data needed from attachment query
The current select for attachments needs to also fetch `file_name`, `file_type`, `file_size`, `uploaded_at`, `uploaded_by`, `uploaded_by_client` to populate the history record.
