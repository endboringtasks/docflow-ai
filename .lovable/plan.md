

## Fix: Client Cannot Upload Replacement for Rejected Document

### Problem
The `portal-request-upload-url` Edge Function blocks uploads when `attachment_count >= max_files`, but doesn't check if the document is rejected. For rejected documents, the old attachments get archived during finalization — so the upload should be allowed.

### Fix

**File: `supabase/functions/portal-request-upload-url/index.ts`**

1. Add `review_status` to the `document_checklist` select query (line 139)
2. Skip the max_files check when `review_status === 'rejected'` (line 158) — the finalize function already archives old attachments before inserting the new one

Single file change + redeploy.

