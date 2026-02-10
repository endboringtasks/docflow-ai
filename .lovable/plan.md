

# Plan: Fix Review Status Counts to Use Applicable Documents Only

## Problem

The four status count buttons (Pending Client, Ready to Review, Approved, Rejected) all filter from `documents` (which includes non-applicable documents) instead of `applicableDocuments`. This causes inflated numbers -- e.g., "Pending Client" shows 34 instead of the correct count based on required + optional only.

## Changes

### File: `src/pages/migration/ApplicationDetail.tsx`

Update all four status count calculations to use `applicableDocuments` instead of `documents`:

| Line | Status | Current | Fix |
|------|--------|---------|-----|
| 2031 | Pending Client | `documents.filter(d => !d.filePath).length` | `applicableDocuments.filter(d => !d.filePath).length` |
| 2049 | Ready to Review | `documents.filter(d => d.reviewStatus === "in_review").length` | `applicableDocuments.filter(d => d.reviewStatus === "in_review").length` |
| 2067 | Approved | `documents.filter(d => d.reviewStatus === "approved").length` | `applicableDocuments.filter(d => d.reviewStatus === "approved").length` |
| 2085 | Rejected | `documents.filter(d => d.reviewStatus === "rejected").length` | `applicableDocuments.filter(d => d.reviewStatus === "rejected").length` |

Also update the `filteredDocuments` filter (line 1687-1691) to filter from `applicableDocuments` instead of `documents`, so clicking a status button only shows applicable documents:

```tsx
const filteredDocuments = useMemo(() => {
  if (reviewFilter === "all") return applicableDocuments;
  if (reviewFilter === "pending_client") return applicableDocuments.filter(d => !d.filePath);
  return applicableDocuments.filter(d => d.filePath && d.reviewStatus === reviewFilter);
}, [applicableDocuments, reviewFilter]);
```

## Result

- All status counts reflect only required + optional documents
- Pending Client count will match the "29" total shown in the header
- Filtering by status also scopes to applicable documents only

## Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | 1687-1691 | Change `documents` to `applicableDocuments` in `filteredDocuments` |
| `src/pages/migration/ApplicationDetail.tsx` | 2031 | Change `documents` to `applicableDocuments` |
| `src/pages/migration/ApplicationDetail.tsx` | 2049 | Change `documents` to `applicableDocuments` |
| `src/pages/migration/ApplicationDetail.tsx` | 2067 | Change `documents` to `applicableDocuments` |
| `src/pages/migration/ApplicationDetail.tsx` | 2085 | Change `documents` to `applicableDocuments` |

