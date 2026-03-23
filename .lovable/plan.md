

## Fix: Rejected Document Status Not Updating After Replacement Upload

### Root Cause
Two issues in `portal-finalize-upload`:

1. **No error handling on the checklist update** — the `document_checklist` update (line 164) uses `await` but never checks if it succeeded. A silent failure would leave the status unchanged.

2. **Stale review metadata** — when a rejected document gets a replacement upload, only `review_comment` is cleared. The `reviewed_by` and `reviewed_at` fields remain, which may confuse the UI into still showing the "Rejected" state.

3. **Possible stale deployment** — the function may need redeployment to ensure the latest code is live.

### Changes

**File: `supabase/functions/portal-finalize-upload/index.ts`**

1. Add error logging on the `document_checklist` update call (capture and log the error from `.update()`)
2. When transitioning from `rejected`, also clear `reviewed_by`, `reviewed_at`, and `review_comment` so the document fully resets
3. Redeploy the edge function

### Code change (lines 164-175)
```typescript
const { error: updateError } = await supabase
  .from('document_checklist')
  .update({
    is_completed: true,
    file_path: storage_path,
    uploaded_at: new Date().toISOString(),
    uploaded_by_client: portalAccess.client_id,
    review_status: newReviewStatus,
    // Clear review metadata if re-uploading after rejection
    ...(docData.review_status === 'rejected' ? {
      review_comment: null,
      reviewed_by: null,
      reviewed_at: null,
    } : {}),
  })
  .eq('id', document_checklist_id)

if (updateError) {
  console.error('Failed to update document_checklist:', updateError)
}
```

Single file edit + redeploy.

