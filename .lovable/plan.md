## Goal

Implement the remaining gaps of **DOC-46 — Document Sync to Drive** so the platform matches the BDD spec. The async upload→Storage→Drive pipeline already exists; the missing pieces are **status-driven review source selection**, **source transparency**, and a **per-file sync-status badge**.

Decisions confirmed:
- Review source is **strict by application status**: `status != 'done'` → Storage only; `status == 'done'` → Drive only.
- **Keep** storing `drive_file_id` / `drive_app_folder_file_id` (BR-4 treated as not applicable to current architecture).
- **Add** a Synced/Pending/Failed sync badge in the review UI (UI-2).

## What already exists (no change needed)

- AC-1 / UI-1: Direct-to-Storage upload via `portal-request-upload-url` + `portal-finalize-upload`; upload succeeds independent of Drive.
- AC-2 / AC-3 / AC-7: `sync-to-drive` worker (pg_cron) copies to the correct application folder only when Drive is connected, and records `sync_status` / `sync_error` / `sync_attempts` on failure.
- UI-5: Drive connection settings UI.

## Changes

### 1. Surface sync + Drive fields in the attachment query
`src/pages/migration/ApplicationDetail.tsx` (attachment select around line 497) currently fetches only `storage_object_path`. Add `sync_status`, `drive_file_id`, `drive_app_folder_file_id`, `synced_at` to the select and to the attachment type/mapping (lines ~126, ~516).

### 2. Status-driven source selection (AC-5 / AC-6, PF-3)
Pass the application `status` into `DocumentPreviewDialog` and the thumbnail loader.

In `DocumentPreviewDialog.tsx` `loadPreview()` (currently always Storage-first):
- Add a `reviewSource: "storage" | "drive"` prop derived from `application.status === 'done' ? 'drive' : 'storage'`.
- When `reviewSource === 'storage'`: use `storageObjectPath` signed URL (existing path); do not call Drive.
- When `reviewSource === 'drive'`: call `get-drive-file-url` with the attachment's `drive_app_folder_file_id` (preferred) or `drive_file_id` and `companyId`; do not use Storage.

In `ApplicationDetail.tsx` `fetchThumbnailUrl` (line ~1814): apply the same status branch so thumbnails come from the source matching the status.

### 3. Graceful fallback messaging (UI-4)
Strict-by-status is the primary behavior. If the status-selected source fails to load:
- Show a clear inline error in the preview ("Couldn't load from Drive / Storage").
- Keep the existing opposite-source path available behind the error as a non-default fallback only (no silent switch), so reviewers aren't fully blocked. This satisfies UI-4's "optional fallback if permitted" without violating the strict default.

### 4. Source transparency indicator (UI-3)
In `DocumentPreviewDialog` header, add a small badge: "Viewing from Drive" or "Viewing from Storage", driven by `reviewSource`.

### 5. Sync-status badge (UI-2)
Create `src/components/visa-application/SyncStatusBadge.tsx` mapping `sync_status` → label/variant:
- `synced` → "Synced" (success token)
- `pending` / `processing` / `waiting_for_drive` → "Pending" (muted/amber)
- `failed` → "Failed" (destructive), tooltip showing `sync_error`
- `not_applicable` → hidden (Drive not connected)

Render it next to each attachment in the review list in `ApplicationDetail.tsx` (attachment row ~2732) and optionally in the preview header. Visible to company members/admins only (this is an internal review screen, already gated).

## Out of scope / notes
- No database migration required — all needed columns already exist.
- `get-drive-file-url` already accepts `file_id` + `company_id` and verifies company membership; no edge-function change expected, but it will be exercised for the `status == 'done'` path.
- No changes to the external client portal upload flow.

## Technical Summary
- Files edited: `src/pages/migration/ApplicationDetail.tsx`, `src/components/visa-application/DocumentPreviewDialog.tsx`.
- File added: `src/components/visa-application/SyncStatusBadge.tsx`.
- Source rule helper: `status === 'done' ? 'drive' : 'storage'`, threaded from `ApplicationDetail` into the preview dialog and thumbnail loader.
- Drive retrieval keys off `drive_app_folder_file_id` then `drive_file_id`.
