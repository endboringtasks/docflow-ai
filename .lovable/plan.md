
# Plan: Document Version History for Audit Trail

## Overview
Implement a document version history system that preserves rejected documents for auditing purposes. When a document is rejected and the client uploads a replacement, the original document(s) will be archived rather than deleted, creating a complete audit trail of the document submission process.

## User Experience

### For Clients (Portal)
- When a document has status "Rejected", the client sees:
  - The rejection feedback message from the agent
  - The current (rejected) document displayed in a "Previous Version" section with a muted/disabled style
  - An upload button to submit a replacement document
- When uploading a replacement:
  - The rejected document is automatically archived (moved to history)
  - The new document becomes the current version
  - Status changes to "In Review"
- Clients **cannot** manually delete rejected documents (only upload replacements)

### For Agents (Admin)
- Can view document history showing all previous versions
- Each historical entry shows: file name, upload date, rejection reason, and who rejected it
- Can download historical documents for reference

## Technical Implementation

### Database Changes

#### New Table: `document_attachment_history`
```text
┌──────────────────────────────────┬──────────────────────────────┐
│ Column                           │ Type                         │
├──────────────────────────────────┼──────────────────────────────┤
│ id                               │ UUID (PK)                    │
│ document_checklist_id            │ UUID (FK)                    │
│ file_path                        │ TEXT                         │
│ file_name                        │ TEXT                         │
│ file_type                        │ TEXT                         │
│ file_size                        │ INTEGER                      │
│ uploaded_at                      │ TIMESTAMPTZ                  │
│ uploaded_by                      │ UUID (nullable)              │
│ uploaded_by_client               │ UUID (nullable)              │
│ archived_at                      │ TIMESTAMPTZ                  │
│ archived_reason                  │ TEXT (e.g., 'rejected')      │
│ review_status_at_archive         │ TEXT                         │
│ review_comment_at_archive        │ TEXT                         │
│ reviewed_by_at_archive           │ UUID                         │
└──────────────────────────────────┴──────────────────────────────┘
```

#### RLS Policies for `document_attachment_history`
- Read: Same rules as `document_attachments` (company members + client portal access)
- Write: Only via service role (edge functions)
- Delete: Restricted (audit logs should not be deleted)

### Edge Function Changes

#### `client-portal-upload/index.ts`
**Current behavior**: When uploading to a rejected document, status changes but old attachments remain

**New behavior**:
1. Before inserting the new attachment, check if `review_status = 'rejected'`
2. If rejected, move ALL current attachments to `document_attachment_history`:
   - Copy attachment records with rejection metadata
   - Delete from `document_attachments`
   - Keep files in storage (do NOT delete physical files)
3. Insert the new attachment as normal
4. Update `review_status` to `in_review`

#### `client-portal-remove-document/index.ts`
**Current behavior**: Allows removing any attachment

**New behavior**:
1. Check the parent document's `review_status`
2. If `review_status = 'rejected'`:
   - Block manual deletion (return error: "Cannot delete rejected documents. Please upload a replacement.")
3. Otherwise, allow normal deletion flow

### Frontend Changes

#### Client Portal (`ClientPortal.tsx`)

1. **Disable delete button for rejected documents**
   - When `review_status === 'rejected'`, hide the X button on attachments
   - Show tooltip explaining they must upload a replacement

2. **Add visual indicator for replacement flow**
   - Show existing attachments as "Previous version (rejected)"
   - Prominent "Upload Replacement" button

3. **Fetch and display history** (optional for phase 2)
   - Add RPC to get document history
   - Show collapsible history section

#### Admin Application View (optional enhancement)
- Add "History" tab or section in document preview dialog
- List all archived versions with metadata

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/migrations/[new]` | Create `document_attachment_history` table with RLS |
| `supabase/functions/client-portal-upload/index.ts` | Archive rejected attachments before new upload |
| `supabase/functions/client-portal-remove-document/index.ts` | Block deletion of rejected documents |
| `src/pages/client-portal/ClientPortal.tsx` | UI changes for rejected document handling |
| `src/integrations/supabase/types.ts` | Will auto-update after migration |

## Implementation Order

1. **Database migration** - Create history table with proper indexes and RLS
2. **Edge function updates** - Archive logic in upload, block deletion in remove
3. **Client Portal UI** - Disable delete for rejected, show replacement flow
4. **Testing** - Verify audit trail is created correctly

## Edge Cases Handled

- **Multiple attachments on rejected document**: All are archived together
- **Already has history**: New rejections add to existing history
- **Google Drive files**: Keep references in history (files remain in Drive)
- **Supabase storage files**: Keep files in storage for historical access
- **Client uploads then gets rejected again**: Creates another history entry

## Security Considerations

- History records are append-only (no updates/deletes via client)
- Physical files are preserved for compliance
- Only company members can view history
- Client portal access is limited to their own documents
