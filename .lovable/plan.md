
# Add Document Status Badges to Client Portal

## Current State

The agent view shows clear status badges next to each document name:
- **Pending Client** - Amber badge with clock icon
- **Ready to Review** - Blue badge with alert icon (not relevant for client view)
- **Approved** - Green badge with checkmark icon
- **Rejected** - Red badge with X icon

The client portal currently uses:
- Border colors to indicate status (amber for pending, red for rejected, green for completed)
- Alert boxes with review comments for documents needing attention
- But **no status badges** like the agent view

## Solution

Add status badges to the client portal that match the agent view's styling, placed next to the document name. This gives clients a quick visual indicator of each document's status.

## Changes

### File: `src/pages/client-portal/ClientPortal.tsx`

Add status badges after the document name in the flex container (around line 1049-1063).

**Status Badge Mappings:**

| Status | Badge Style | Icon | When to Show |
|--------|-------------|------|--------------|
| Pending Client | Amber outline badge | Clock | `review_status === 'pending_client'` OR no attachments |
| In Review | Blue outline badge | AlertCircle | `review_status === 'in_review'` and has attachments |
| Approved | Green solid badge | CheckCircle2 | `review_status === 'approved'` |
| Rejected | Red destructive badge | XCircle | `review_status === 'rejected'` |

**Implementation:**

Add status badges inside the `flex items-center gap-2 flex-wrap` div that contains the document name:

```tsx
{/* Document name */}
<p className="font-medium text-sm ...">
  {doc.document_name...}
</p>

{/* NEW: Status Badges matching agent view */}
{/* Pending Client - when no attachments OR status is pending_client */}
{(doc.attachment_count === 0 || doc.review_status === "pending_client") && (
  <Badge variant="outline" className="text-xs text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-950/30">
    <Clock className="w-3 h-3 mr-1" />
    Pending Client
  </Badge>
)}

{/* In Review - has attachments and status is in_review */}
{doc.attachment_count > 0 && doc.review_status === "in_review" && (
  <Badge variant="outline" className="text-xs text-blue-600 border-blue-400 bg-blue-50 dark:bg-blue-950/30">
    <AlertCircle className="w-3 h-3 mr-1" />
    In Review
  </Badge>
)}

{/* Approved */}
{doc.attachment_count > 0 && doc.review_status === "approved" && (
  <Badge variant="default" className="text-xs bg-green-600">
    <CheckCircle2 className="w-3 h-3 mr-1" />
    Approved
  </Badge>
)}

{/* Rejected */}
{doc.attachment_count > 0 && doc.review_status === "rejected" && (
  <Badge variant="destructive" className="text-xs">
    <XCircle className="w-3 h-3 mr-1" />
    Rejected
  </Badge>
)}

{/* Existing: Optional badge */}
{doc.requirement_type === "optional" && (
  <Badge variant="secondary" className="text-xs">
    Optional
  </Badge>
)}
```

**Additional Changes:**

1. Import `XCircle` icon from lucide-react (not currently imported)

## Visual Result

**Before:**
```
[✓] Tax Returns   [Optional]
```

**After:**
```
[✓] Tax Returns   [⏱ Pending Client]  [Optional]
```

Or for approved:
```
[✓] Tax Returns   [✓ Approved]  [Optional]
```

The badges will match the exact colors used in the agent view:
- Amber for Pending Client
- Blue for In Review  
- Green for Approved
- Red for Rejected

This gives clients clear visibility into where each document stands in the review process.
