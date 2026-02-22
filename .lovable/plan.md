

## Migrate to Direct-to-Storage + Async Google Drive Sync

This migration eliminates double bandwidth through Supabase Edge Functions by having the browser upload directly to Supabase Storage via signed URLs, then syncing to Google Drive asynchronously in the background.

### Current Architecture Problem

Every file upload flows: **Browser -> Edge Function -> Google Drive**, consuming Supabase bandwidth twice (receiving the file + sending it to Drive). Downloads do the reverse with base64 encoding. This is expensive and slow.

### New Architecture

```text
UPLOAD:
  Browser ──signed URL──> Supabase Storage (direct, zero edge bandwidth)
  Browser ──small JSON──> portal-finalize-upload (metadata only)
  Background cron ──────> sync-to-drive (Storage -> Drive, server-to-server)

DOWNLOAD:
  If storage_object_path exists -> signed download URL (instant, no edge function)
  Else (legacy drive://)        -> existing get-drive-file-url (unchanged)
```

---

### Step 1 -- Database Migration

Add tracking columns to `document_attachments`:
- `storage_object_path` (TEXT) -- path in Storage bucket
- `drive_file_id` (TEXT) -- Google Drive file ID after sync
- `drive_app_folder_file_id` (TEXT) -- Drive file ID for renamed copy in application folder
- `sync_status` (TEXT, default 'pending') -- pending, processing, synced, failed, waiting_for_drive, not_applicable
- `sync_error` (TEXT) -- error message on failure
- `sync_attempts` (INTEGER, default 0) -- retry counter
- `last_sync_attempt_at` (TIMESTAMPTZ) -- for backoff calculation
- `synced_at` (TIMESTAMPTZ) -- when sync completed
- `source` (TEXT, default 'storage') -- where file was originally uploaded

Add same columns to `document_attachment_history` for archival consistency.

Backfill existing records with `drive://` paths: set `source = 'drive'`, `sync_status = 'not_applicable'`, extract `drive_file_id`.

Add CHECK constraint for `sync_status` allowed values.

Update RLS: add UPDATE policy for `document_attachments` (currently missing -- needed for sync status updates via service role).

---

### Step 2 -- New Edge Function: `portal-request-upload-url`

- Validates portal access token (not expired, not submitted)
- Validates `document_checklist_id` belongs to the portal's visa application
- Checks attachment count against `max_files`
- Validates MIME type against allowlist and file size (25MB limit)
- Rate limits: 10 requests per token per 5 min, 50 per IP per 5 min
- Generates signed upload URL to `document-attachments` bucket
- Path pattern: `{document_checklist_id}/{timestamp}_{sanitized_filename}`
- Signed URL expires in 10 minutes
- Returns: `{ upload_url, storage_path, expires_in, max_file_size }`
- `verify_jwt = false` in config.toml

---

### Step 3 -- New Edge Function: `portal-finalize-upload`

Called after browser completes direct upload to Storage.

- Validates portal access token again
- Verifies storage object exists at the given path
- Creates `document_attachments` record with `storage_object_path`, `sync_status = 'pending'`, `source = 'storage'`
- Sets `file_path` to `storage_object_path` for backward compatibility
- Handles rejected document archival (reuses existing logic from `client-portal-upload`)
- Updates `document_checklist` (is_completed, review_status) with same smart status logic
- Returns attachment metadata
- `verify_jwt = false` in config.toml

---

### Step 4 -- Frontend Portal Changes (ClientPortal.tsx)

Replace `handleFileUpload` function:

**Old**: Send FormData with full file to `client-portal-upload` edge function

**New**:
1. Call `portal-request-upload-url` with `{ token, doc_id, file_name, file_type, file_size }`
2. Upload file directly to Storage via signed URL (PUT request)
3. Track upload progress using `XMLHttpRequest` progress events
4. On success, call `portal-finalize-upload` with `{ token, doc_id, storage_path, file_name, file_type, file_size }`
5. Refresh documents

Add a progress bar during upload using the existing `Progress` component.

---

### Step 5 -- New Edge Function: `sync-to-drive` (Background Sync)

Triggered via `pg_cron` every 2 minutes.

**Concurrency-safe query**:
- SELECT with `FOR UPDATE SKIP LOCKED` on rows where `sync_status IN ('pending', 'failed')` and `sync_attempts < 5`
- Immediately set to `processing` state
- Skip items still in backoff window (exponential: 0, 2, 5, 15, 60 minutes)

**Per-attachment logic**:
1. Look up visa application, client, company via `document_checklist`
2. Check company Drive connection; if not connected, set `waiting_for_drive`
3. Get valid access token (reuse `getValidAccessToken` pattern)
4. Download file from Storage via service role signed URL
5. Upload to Drive: original to Documents Received folder, renamed copy to application folder
6. Save `drive_file_id`, `drive_app_folder_file_id`, update `file_path` to `drive://{id}`, set `sync_status = 'synced'`
7. On failure: set `sync_status = 'failed'`, `sync_error = message`

**Idempotency**: if `drive_file_id` already set, skip.

Requires `pg_cron` and `pg_net` extensions enabled. The cron job will call the function via HTTP.

---

### Step 6 -- Download Refactor

**`client-portal-get-file-url`**: If the attachment has `storage_object_path`, generate a signed download URL directly from Storage (no Drive fetch needed). Fall back to existing Drive logic for legacy files.

**`get-drive-file-url`**: Add similar check -- if `storage_object_path` exists on the attachment, return a signed Storage URL instead of streaming from Drive as base64.

**Frontend** (`ApplicationDetail.tsx`, `DocumentPreviewDialog.tsx`): When `storage_object_path` is available, use the signed URL directly. Fall back to Drive flow for legacy files.

---

### Step 7 -- New Edge Function: `cleanup-synced-storage`

Daily cron job:
- Query attachments where `sync_status = 'synced'` and `synced_at` older than retention period (default 30 days, configurable via `platform_settings`)
- Verify Drive file still accessible before deleting Storage object
- Delete storage object, set `storage_object_path = NULL`
- Never delete Drive file

---

### Step 8 -- Cleanup

- Delete `internal-upload` edge function (dead code, no frontend callers)
- Keep `client-portal-upload` temporarily for backward compatibility but mark deprecated
- Remove `internal-remove-attachment` if it exists (dead code)

---

### Backward Compatibility

- All existing `drive://` file paths continue to work unchanged
- New uploads work immediately via Storage (before Drive sync completes)
- After Drive sync, `file_path` is updated to `drive://` format
- Download code checks `storage_object_path` first, then falls back
- The 2 existing Supabase Storage files continue to work

---

### Security

- Signed upload URLs expire in 10 minutes
- File size validated before issuing URL (server-side)
- MIME type allowlist enforced
- Portal tokens never logged
- Drive tokens remain encrypted server-side (only in `sync-to-drive`)
- Rate limiting on upload URL endpoint
- Checklist ownership validated at every step

---

### Implementation Order

| Order | What | Type |
|---|---|---|
| 1 | Database migration (add columns, backfill, CHECK constraint) | SQL migration |
| 2 | `portal-request-upload-url` edge function | New file |
| 3 | `portal-finalize-upload` edge function | New file |
| 4 | Frontend upload refactor in `ClientPortal.tsx` | Modify |
| 5 | `sync-to-drive` edge function + pg_cron job | New file + SQL |
| 6 | Download refactor (`client-portal-get-file-url`, `get-drive-file-url`, frontend) | Modify |
| 7 | `cleanup-synced-storage` edge function + pg_cron job | New file + SQL |
| 8 | Delete `internal-upload`, deprecate `client-portal-upload` | Delete/modify |

---

### Files Summary

**New files:**
- `supabase/functions/portal-request-upload-url/index.ts`
- `supabase/functions/portal-finalize-upload/index.ts`
- `supabase/functions/sync-to-drive/index.ts`
- `supabase/functions/cleanup-synced-storage/index.ts`

**Modified files:**
- `src/pages/client-portal/ClientPortal.tsx` (upload flow + progress bar)
- `src/pages/migration/ApplicationDetail.tsx` (download logic)
- `src/components/visa-application/DocumentPreviewDialog.tsx` (download logic)
- `supabase/functions/client-portal-get-file-url/index.ts` (storage_object_path check)
- `supabase/functions/get-drive-file-url/index.ts` (storage_object_path check)
- `supabase/config.toml` (new function entries)

**Deleted files:**
- `supabase/functions/internal-upload/index.ts`

