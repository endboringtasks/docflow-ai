

# Plan: Fix Review Status Count and Add Label

## Problem

The "Review Status" section shows `{completedCount} of {documents.length} collected`, which uses `documents.length` (unfiltered, may include non-applicable documents). It should use `applicableDocuments.length` (required + optional) and include a "(required + optional)" label.

## Changes

### File: `src/pages/migration/ApplicationDetail.tsx` (line 1992)

Change:
```tsx
{completedCount} of {documents.length} collected
```

To:
```tsx
{completedCount} of {applicableDocuments.length} collected (required + optional)
```

This ensures:
- The total count matches required + optional documents only (excluding non-applicable)
- The label clarifies what the number represents
- Consistency with the header stats showing Required and Optional separately

## File to Modify

| File | Line | Change |
|------|------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | 1992 | Replace `documents.length` with `applicableDocuments.length` and add "(required + optional)" label |

