# Fix: Blank "Review" preview for synced documents (draft applications)

## Problem
On `/app/migration/applications/55a854de-...`, clicking **Review** opens the dialog, signs a valid Storage URL (badge correctly reads "Viewing from Storage"), but the preview area is blank.

## Root cause
In `DocumentPreviewDialog.tsx`, the file-type detection (`isDrive`, `isImage`, `isPdf`, `canPreview`) is derived from `document.filePath`. For these records `document_checklist.file_path = "drive://<id>"` (it mirrors the synced Drive id), so `isDrive = true`.

When the application status is `draft`, `reviewSource = "storage"`, so the dialog loads the file from Storage (via `storageObjectPath`) and never populates `driveFileInfo`. But because `isDrive` is `true`, `isImage`/`isPdf` are computed from `driveFileInfo` (which is `null`), so both are false and the render block outputs neither `<img>` nor `<iframe>` → blank preview.

In short: the type detection follows the stored `filePath` scheme, not the source actually being displayed.

## Fix (frontend only)
Make file-type detection follow the **active source / real file name**, not the `drive://` path.

1. Pass the real file name to the dialog. In `ApplicationDetail.tsx` where the `document` prop is built (around line 3235), add a `fileName` field from `previewDoc.attachments?.[0]?.file_name` (fallback to `name`). This gives a reliable extension for type detection regardless of `filePath` scheme.

2. In `DocumentPreviewDialog.tsx`:
   - Add optional `fileName?: string | null` to the `document` prop type.
   - Compute type detection based on `activeSource`:
     - When `activeSource === "drive"` and `driveFileInfo` is present, use `driveFileInfo.mimeType` (current behavior).
     - Otherwise (Storage, or Drive before metadata loads), derive `isImage`/`isPdf` from the real file name extension — prefer `document.fileName`, then `storageObjectPath`, then `filePath` (stripping any `drive://` prefix before checking the extension).
   - Update `canPreview`, `isImage`, `isPdf` to use this source-aware logic so a Storage-loaded image/PDF renders even when `filePath` starts with `drive://`.

3. Keep the existing strict-by-status source selection and graceful fallback untouched; only the type-detection/rendering branch changes.

## Verification
- Open the affected application (draft) and click Review on a synced document → image/PDF now renders from Storage with the "Viewing from Storage" badge.
- Set an application to `done` and confirm Drive-sourced preview still works.

## Files
- `src/components/visa-application/DocumentPreviewDialog.tsx`
- `src/pages/migration/ApplicationDetail.tsx`
