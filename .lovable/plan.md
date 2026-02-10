

# Plan: Restore Visibility of Conditional Documents (e.g., Previous Visas)

## Problem

After the recent change to filter the Review Status section by `applicableDocuments`, conditional documents (like "Previous Visas") that are disabled (`isApplicable: false`) are completely hidden from the checklist. Since they're invisible, agents can no longer find or re-enable them using the toggle switch.

## Root Cause

Line 1687 changed `filteredDocuments` to start from `applicableDocuments` (which excludes disabled conditional docs). The document list renders from `filteredDocuments`, so disabled conditionals disappear entirely.

## Fix

### File: `src/pages/migration/ApplicationDetail.tsx`

Update the `filteredDocuments` memo to include **all conditional documents** alongside applicable ones, so the enable/disable toggle remains accessible.

**Current (line 1686-1692):**
```tsx
const filteredDocuments = useMemo(() => {
  if (reviewFilter === "all") return applicableDocuments;
  if (reviewFilter === "pending_client") return applicableDocuments.filter(d => !d.filePath);
  return applicableDocuments.filter(d => d.filePath && d.reviewStatus === reviewFilter);
}, [applicableDocuments, reviewFilter]);
```

**Updated:**
```tsx
const filteredDocuments = useMemo(() => {
  // Always include disabled conditional documents so the toggle remains visible
  const conditionalDisabled = documents.filter(d => d.requirementType === "conditional" && !d.isApplicable);

  if (reviewFilter === "all") return [...applicableDocuments, ...conditionalDisabled];
  if (reviewFilter === "pending_client") return [
    ...applicableDocuments.filter(d => !d.filePath),
    ...conditionalDisabled,
  ];
  return [
    ...applicableDocuments.filter(d => d.filePath && d.reviewStatus === reviewFilter),
    ...conditionalDisabled,
  ];
}, [documents, applicableDocuments, reviewFilter]);
```

This ensures:
- Disabled conditional documents (like "Previous Visas") always appear in the checklist with their toggle switch
- Progress counts and status counts remain scoped to applicable documents only (unchanged)
- Once a user enables a conditional document via the toggle, it moves into the applicable set and participates in counts normally

## Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | 1686-1692 | Include disabled conditional documents in `filteredDocuments` |

