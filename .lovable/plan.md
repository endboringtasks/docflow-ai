# Fix: Document thumbnails show generic icon instead of image/PDF preview

## Problem
In the application detail document list, attachment thumbnails render a generic file icon instead of the actual image/PDF preview, even though a valid thumbnail URL is loaded.

## Root cause
`DocumentThumbnail` decides the rendering (image vs PDF vs icon) from its `filePath` prop. Attachments pass `filePath={attachment.file_path}`, which for synced files is `drive://<id>` — no file extension. So `isImageFile(filePath)` and `isPdfFile(filePath)` both return false and the component always falls back to the generic `<File>` icon, ignoring the loaded `fileUrl`.

This is the same class of bug already fixed in `DocumentPreviewDialog`: type detection must follow the real file name, not the `drive://` path scheme.

## Fix (frontend only)
1. `src/components/documents/DocumentThumbnail.tsx`:
   - Add an optional `fileName?: string | null` prop.
   - Use `fileName` (when provided) for `isImageFile` / `isPdfFile` type detection, falling back to `filePath` when `fileName` is absent. Strip any `drive://` prefix before extension checks as a safety net.
   - Keep using `fileUrl` for the actual `<img>` / PDF thumbnail source.

2. `src/pages/migration/ApplicationDetail.tsx`:
   - Pass `fileName={attachment.file_name}` at the attachment thumbnail (around line 2774).
   - For the legacy single-file thumbnail (around line 2814), pass `fileName={doc.fileName ?? doc.filePath}` (legacy `filePath` is a real storage path with extension, so this stays correct).

## Verification
- Open the affected draft application: attachment rows now show image/PDF thumbnails instead of the generic icon.
- Confirm non-previewable file types still show the generic icon.
- Confirm legacy single-file documents still render thumbnails.

## Files
- `src/components/documents/DocumentThumbnail.tsx`
- `src/pages/migration/ApplicationDetail.tsx`
