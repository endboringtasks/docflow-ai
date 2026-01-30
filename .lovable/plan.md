
# Fix "Request Different Doc" Workflow

## Problem

When an agent clicks "Request Different Doc":
1. The document status is set to `pending_client` with a `review_comment`
2. But the **client portal doesn't show** the review status or comment
3. When the client uploads a new file, it **overwrites the status back to `in_review`** without the client ever seeing the feedback
4. The client has no way to know a different document was requested

## Solution Overview

Fix the workflow so clients can see when action is needed and why:

1. **Update `get_portal_documents` RPC** to return `review_status` and `review_comment`
2. **Show review feedback in Client Portal** with a highlighted alert for documents needing attention
3. **Smart status handling on upload** - only set `in_review` if previous status was `pending_client` (indicating client addressed the feedback)
4. **Visual highlighting** for documents with `pending_client` or `rejected` status

## Changes

### 1. Database: Update `get_portal_documents` Function

Add `review_status` and `review_comment` to the returned columns:

| Column | Type | Purpose |
|--------|------|---------|
| `review_status` | text | Show if document needs attention |
| `review_comment` | text | Show agent's feedback to client |

```sql
CREATE OR REPLACE FUNCTION public.get_portal_documents(p_token text)
RETURNS TABLE(
  -- existing columns...
  review_status text,      -- NEW
  review_comment text      -- NEW
)
```

### 2. Client Portal: Add Review Status/Comment to Document Interface

Update `DocumentItem` interface:

```typescript
interface DocumentItem {
  // existing fields...
  review_status: string | null;
  review_comment: string | null;
}
```

### 3. Client Portal: Show Alert for Documents Needing Attention

For documents with `pending_client` or `rejected` status:

```
┌────────────────────────────────────────────────────┐
│ ⚠️ Action Required                                 │
│ ───────────────────────────────────────────────── │
│ 📄 Tax Returns                                     │
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ ⚠ Your agent has requested a different       │  │
│ │   document:                                   │  │
│ │   "Please provide 2024 tax returns instead   │  │
│ │    of 2023"                                   │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│ [Previously uploaded: tax_returns_2023.pdf  ✕]    │
│                                                    │
│ [📤 Upload New Document]                           │
└────────────────────────────────────────────────────┘
```

Visual indicators:
- Orange/amber border for `pending_client` status
- Red border for `rejected` status  
- Alert box with agent's comment prominently displayed
- Clear indication that a new upload is needed

### 4. Upload Edge Function: Smart Status Handling

Current behavior (problematic):
```typescript
// Always resets to in_review
.update({ 
  review_status: 'in_review'  // Overwrites pending_client
})
```

New behavior:
```typescript
// Only change status if document was pending action from client
// This acknowledges the client addressed the agent's request
.update({ 
  review_status: 'in_review'  // Only when previous was pending_client
})
```

This ensures:
- Documents in `approved` status stay approved (unless explicitly changed)
- Documents in `pending_client` move to `in_review` when new file uploaded
- Documents in `rejected` stay rejected (agent must manually review)

## Files to Change

| File | Change |
|------|--------|
| `supabase/migrations/...` | Update `get_portal_documents` RPC to return review fields |
| `src/pages/client-portal/ClientPortal.tsx` | Add `review_status` and `review_comment` to interface, render alert for pending docs |
| `supabase/functions/client-portal-upload/index.ts` | Smart status handling based on previous status |

## Implementation Details

### Client Portal UI Updates

1. **Document card styling based on status**:
   - `pending_client`: Amber/orange border with warning icon
   - `rejected`: Red border with error styling
   - `in_review`: Normal styling
   - `approved`: Green styling (already exists)

2. **Alert component for feedback**:
   ```tsx
   {(doc.review_status === 'pending_client' || doc.review_status === 'rejected') && 
    doc.review_comment && (
     <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 
                     dark:border-amber-800 rounded-lg">
       <div className="flex items-start gap-2">
         <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
         <div>
           <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
             {doc.review_status === 'rejected' 
               ? 'Document Rejected' 
               : 'Different Document Requested'}
           </p>
           <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
             {doc.review_comment}
           </p>
         </div>
       </div>
     </div>
   )}
   ```

3. **Progress calculation update**: Documents with `pending_client`/`rejected` status should not count as complete in progress calculations

## Expected Behavior After Fix

1. Agent reviews document → clicks "Request Different Doc" with comment "Please provide 2024 version"
2. Document status → `pending_client`, comment saved
3. Client opens portal → sees highlighted document with agent's message
4. Client uploads new document
5. Status → `in_review` (ready for agent to review again)
6. Agent gets notification of new upload
7. Agent reviews and approves/rejects

## Technical Notes

- The RPC function change requires a migration
- No changes to database schema (columns already exist)
- Edge function change doesn't require redeployment approval (auto-deployed)
