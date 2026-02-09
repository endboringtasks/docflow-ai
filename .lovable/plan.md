
# Plan: Document Version History for Audit Trail

## ✅ IMPLEMENTATION COMPLETE

## Overview
Implemented a document version history system that preserves rejected documents for auditing purposes. When a document is rejected and the client uploads a replacement, the original document(s) are archived rather than deleted, creating a complete audit trail of the document submission process.

## Changes Made

### 1. Database Migration
- Created `document_attachment_history` table with columns for:
  - Original attachment data (file_path, file_name, file_type, file_size, uploaded_at, uploaded_by)
  - Archive metadata (archived_at, archived_reason)
  - Review snapshot (review_status_at_archive, review_comment_at_archive, reviewed_by_at_archive)
- Added indexes for efficient querying by document_checklist_id and archived_at
- Enabled RLS with policies for company members and client portal users
- Write access restricted to service role only (append-only audit log)

### 2. Edge Function: `client-portal-upload`
- Added logic to check if document has `review_status = 'rejected'` before upload
- If rejected, archives ALL existing attachments to `document_attachment_history`:
  - Copies attachment records with rejection metadata
  - Deletes from `document_attachments` table
  - Keeps physical files in storage for audit trail
- Updates `review_status` from 'rejected' to 'in_review' after replacement upload

### 3. Edge Function: `client-portal-remove-document`
- Added check for parent document's `review_status`
- If `review_status === 'rejected'`, blocks deletion with error message:
  - "Cannot delete rejected documents. Please upload a replacement document instead."
- Normal deletion flow continues for non-rejected documents

### 4. Client Portal UI (`ClientPortal.tsx`)
- **Delete button hidden** for rejected documents
- Rejected attachments shown with:
  - "Previous version (will be replaced)" label
  - Muted/strikethrough styling
  - Info icon with tooltip explaining replacement is needed
- **Upload button** shows "Upload Replacement" (primary variant) for rejected documents
- Existing rejected attachments displayed in red-tinted container

## User Experience

### For Clients (Portal)
- When a document is rejected:
  - See rejection feedback message from agent
  - Existing attachments shown as "Previous version" with muted styling
  - Cannot delete rejected attachments (X button hidden)
  - Prominent "Upload Replacement" button
- When uploading replacement:
  - Old attachments automatically archived to history
  - New document becomes current version
  - Status changes to "In Review"

### For Agents (Admin)
- Document history preserved in `document_attachment_history` table
- Can query history for audit purposes
- Physical files remain in storage for reference

## Files Modified

| File | Changes |
|------|---------|
| Database | New `document_attachment_history` table with RLS |
| `supabase/functions/client-portal-upload/index.ts` | Archive logic for rejected attachments |
| `supabase/functions/client-portal-remove-document/index.ts` | Block deletion of rejected docs |
| `src/pages/client-portal/ClientPortal.tsx` | UI updates for rejected document handling |

## Security Considerations
- History records are append-only (no client UPDATE/DELETE policies)
- Physical files preserved for compliance
- RLS ensures company members can only view their own history
- Client portal access limited to their own documents
