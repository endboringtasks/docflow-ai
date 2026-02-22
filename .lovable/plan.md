

## Disable Supabase Storage Fallback

Remove the Supabase Storage fallback from all upload edge functions so that uploads **require** Google Drive. If Drive is not connected or the upload fails, the request will return an error instead of silently falling back.

### Existing Data

There are **2 files** currently stored in Supabase Storage (not Google Drive):
- `bc1a8d3f.../1767434650886.gif`
- `a1eced30.../1768456966566.pdf`

These will still be viewable/downloadable since the reading code (`get-drive-file-url`, `client-portal-get-file-url`, `DocumentPreviewDialog`, `ApplicationDetail`, `DocumentHistorySection`) already handles both `drive://` and non-`drive://` paths. We should **keep the read/download logic** for Supabase Storage paths so existing files remain accessible, but **remove the write/upload fallback**.

### Changes

---

**1. Edge Function: `supabase/functions/internal-upload/index.ts`**

Replace the Supabase Storage fallback block (lines 579-600) with an error response:

```typescript
// Instead of falling back to Supabase storage, return an error
if (!filePath) {
  console.error('Google Drive upload failed and no fallback available')
  return new Response(
    JSON.stringify({ error: 'Google Drive upload failed. Please ensure Google Drive is connected and folders are configured.' }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
```

Also remove the Supabase Storage cleanup in the error handler (lines 614-617) since files will never be in Supabase Storage anymore.

Update the response to always say `google_drive` (remove the ternary).

---

**2. Edge Function: `supabase/functions/client-portal-upload/index.ts`**

Same pattern -- replace the fallback block (lines 689-710) with an error response, remove the Supabase Storage cleanup (lines 728-731), and update the response.

---

**3. Edge Function: `supabase/functions/internal-remove-attachment/index.ts`**

This function is already confirmed as dead code (nothing calls it from the UI). It will be **deleted entirely** as a separate cleanup.

---

**4. Edge Function: `supabase/functions/client-portal-remove-document/index.ts`**

Keep the Supabase Storage **deletion** logic here. It still needs to handle removing legacy files that were stored in Supabase Storage (the 2 existing files). No changes needed.

---

**5. Frontend files (NO changes)**

- `ApplicationDetail.tsx`, `DocumentPreviewDialog.tsx`, `DocumentHistorySection.tsx`, `client-portal-get-file-url` -- all keep their Supabase Storage **read** logic to serve the 2 existing files.

---

### Summary of file changes

| File | Action |
|---|---|
| `supabase/functions/internal-upload/index.ts` | Remove storage fallback, return error instead |
| `supabase/functions/client-portal-upload/index.ts` | Remove storage fallback, return error instead |
| `supabase/functions/internal-remove-attachment/index.ts` | Delete entirely (dead code) |
| Frontend files | No changes (keep read support for legacy files) |

