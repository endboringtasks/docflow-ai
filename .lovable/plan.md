

# Fix: Client Portal Delete Not Resetting Document Status

## Root Cause

The edge function `client-portal-remove-document` has a bug where it tries to set `review_status = 'pending'` when a client deletes all attachments and the previous status was NOT `pending_client`. However, the database has a check constraint that only allows: `pending_client`, `in_review`, `approved`, `rejected`.

This causes the `UPDATE` on `document_checklist` to **fail silently** -- the error is logged but the function still returns `{ success: true }`. As a result:
- `is_completed` stays `true` (green checkmark persists)
- `file_path` keeps pointing to the old Drive file
- The client portal shows stale data

## Fix

### File: `supabase/functions/client-portal-remove-document/index.ts`

**Change 1 - Attachment flow (around line 318-319):**

Replace `'pending'` with `'in_review'` as the fallback status when the previous status is not `pending_client`:

```ts
// Before (BROKEN):
newReviewStatus = isCompleted ? 'in_review' : 'pending'

// After (FIXED):
newReviewStatus = 'in_review'
```

**Change 2 - Legacy flow (around line 450):**

Same fix -- replace `'pending'` with `'in_review'`:

```ts
// Before (BROKEN):
newReviewStatus = 'pending'

// After (FIXED):
newReviewStatus = 'in_review'
```

The rationale: when a client deletes their files, the document should go back to `in_review` status (agent can see it needs attention), unless it was already `pending_client` (which is preserved to keep the "request different doc" workflow intact).

### Manual Data Fix

The CoE document `f68000bc-a9e1-49e9-b1da-826d4eba3a66` currently has stale data (`is_completed: true`, `file_path` pointing to deleted Drive file, `review_status: in_review` with 0 attachments). This needs a one-time fix via SQL after deploying the edge function fix, or alternatively, the client can re-upload and re-delete to trigger the corrected logic.

### Edge Function to Deploy
- `client-portal-remove-document`

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/client-portal-remove-document/index.ts` | Replace invalid `'pending'` status with `'in_review'` in both attachment and legacy flows |

