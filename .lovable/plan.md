

# Fix Review Status Badge Display for "Request Different Doc"

## Problem

When an agent clicks "Request Different Doc", the database correctly updates to `pending_client` status, but the UI still shows "Ready to Review" badge. This happens because the badge display logic doesn't properly handle the `pending_client` status when there are already attachments.

## Root Cause

In `ApplicationDetail.tsx`, the badge logic at lines 2138-2161 has this flow:

```
If attachmentCount === 0 → Show "Pending Client"
If attachmentCount > 0 && status === approved → Show "Approved"
If attachmentCount > 0 && status === rejected → Show "Rejected"
If attachmentCount > 0 && status !== approved && status !== rejected → Show "Ready to Review"
```

The problem: When status is `pending_client` but there ARE attachments (from the previously uploaded wrong document), it falls into the last condition and shows "Ready to Review" instead of the correct "Pending Client" badge.

## Solution

Update the badge display logic to properly check for `pending_client` status regardless of attachment count:

| Condition | Badge |
|-----------|-------|
| `attachmentCount === 0` OR `reviewStatus === "pending_client"` | Pending Client (amber) |
| `attachmentCount > 0` && `reviewStatus === "approved"` | Approved (green) |
| `attachmentCount > 0` && `reviewStatus === "rejected"` | Rejected (red) |
| `attachmentCount > 0` && `reviewStatus === "in_review"` | Ready to Review (blue) |

## File to Change

| File | Change |
|------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | Fix badge display conditions around lines 2138-2161 |

## Changes

### Before (current logic):
```tsx
{/* Line 2138-2143: Only shows pending when NO attachments */}
{doc.attachmentCount === 0 && (
  <Badge variant="outline" className="text-xs text-amber-600 ...">
    <Clock className="w-3 h-3 mr-1" />
    Pending Client
  </Badge>
)}

{/* Line 2156-2161: Catches pending_client incorrectly */}
{doc.attachmentCount > 0 && doc.reviewStatus !== "approved" && doc.reviewStatus !== "rejected" && (
  <Badge variant="outline" className="text-xs text-blue-600 ...">
    <AlertCircle className="w-3 h-3 mr-1" />
    Ready to Review
  </Badge>
)}
```

### After (fixed logic):
```tsx
{/* Show "Pending Client" when no attachments OR status is pending_client */}
{(doc.attachmentCount === 0 || doc.reviewStatus === "pending_client") && (
  <Badge variant="outline" className="text-xs text-amber-600 ...">
    <Clock className="w-3 h-3 mr-1" />
    Pending Client
  </Badge>
)}

{/* Only show "Ready to Review" for in_review status */}
{doc.attachmentCount > 0 && doc.reviewStatus === "in_review" && (
  <Badge variant="outline" className="text-xs text-blue-600 ...">
    <AlertCircle className="w-3 h-3 mr-1" />
    Ready to Review
  </Badge>
)}
```

## Visual Result After Fix

**Document with wrong file + "Request Different Doc" clicked:**

| Before | After |
|--------|-------|
| Ready to Review (blue badge) | Pending Client (amber badge) |

The amber "Pending Client" badge correctly indicates the client needs to take action and upload a different document.

