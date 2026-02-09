
# Plan: Fix Upload Button for Rejected Documents

## Problem Identified
The "Upload Replacement" button is not appearing for rejected documents when the file limit has been reached. 

Looking at your screenshot, the "Diploma" documents show as "Rejected" with existing attachments, but there's no upload button visible to submit a replacement.

**Root Cause** (Line 1024 in ClientPortal.tsx):
```typescript
const canUploadMore = doc.max_files === null || doc.attachment_count < doc.max_files;
```

When a document with `max_files = 1` already has 1 attachment (even if rejected), this evaluates to `false`, hiding the upload button.

## Solution
Update the `canUploadMore` logic to ALWAYS allow uploads when a document is rejected, regardless of the current attachment count. This makes sense because:
1. The rejected attachments will be archived (moved to history) when the replacement is uploaded
2. The client MUST be able to upload a replacement - that's the whole point of the rejection workflow

## Implementation

### File: `src/pages/client-portal/ClientPortal.tsx`

**Location**: Line 1024

**Current code**:
```typescript
const canUploadMore = doc.max_files === null || doc.attachment_count < doc.max_files;
```

**Updated code**:
```typescript
const isRejected = doc.review_status === 'rejected';
const canUploadMore = isRejected || doc.max_files === null || doc.attachment_count < doc.max_files;
```

This ensures that when `review_status === 'rejected'`, the upload button is always shown regardless of how many attachments currently exist.

**Note**: We need to move the `isRejected` variable declaration earlier (currently it's defined on line 1031) since we need it for the `canUploadMore` calculation.

## Files to Modify
| File | Changes |
|------|---------|
| `src/pages/client-portal/ClientPortal.tsx` | Move `isRejected` declaration to line ~1024 and include it in `canUploadMore` condition |

## Expected Result
- Rejected documents will always show the "Upload Replacement" button
- Clients can upload a replacement document which will archive the old one
- Non-rejected documents maintain the existing max file limit behavior
