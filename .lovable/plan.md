

# Plan: Add Optional Completion Count to Client Portal Badge

## Problem

The Client Portal badge shows `1/28 required + 1 optional` but doesn't track optional completion. The Application Detail page shows `0/28 complete` for required and `0/1 complete` for optional. These should be consistent.

## Changes

### File: `src/pages/client-portal/ClientPortal.tsx`

**1. Add optional completed count (after line 702):**

```tsx
const optionalCompleted = optionalDocuments.filter(d => 
  d.is_completed && 
  d.review_status !== 'pending_client' && 
  d.review_status !== 'rejected'
).length;
```

**2. Update badge display (line 933):**

Change from:
```tsx
{completedDocs}/{totalDocs} required{optionalCount > 0 ? ` + ${optionalCount} optional` : ''}
```

To:
```tsx
{completedDocs}/{totalDocs} required{optionalCount > 0 ? ` + ${optionalCompleted}/${optionalCount} optional` : ''}
```

This will display: `1/28 required + 0/1 optional`

**3. Update submit confirmation dialog (around lines 1414-1416):**

Update to also show optional completion:
```tsx
<strong>{completedDocs}</strong> of <strong>{totalDocs}</strong> required documents uploaded.
{optionalCount > 0 && <> Plus <strong>{optionalCompleted}/{optionalCount}</strong> optional.</>}
```

## Result

- Client Portal badge: `1/28 required + 0/1 optional` (matches Application Detail format)
- Both views consistently show completion counts for required and optional documents

## File to Modify

| File | Change |
|------|--------|
| `src/pages/client-portal/ClientPortal.tsx` | Add `optionalCompleted` variable; update badge and submit dialog to show optional completion |

