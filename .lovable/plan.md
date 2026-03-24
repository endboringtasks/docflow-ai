

## Fix Review Status Filter in Application Page

### Problem
The filter logic at lines 1751-1758 is incorrect:
- **"pending_client"** filter checks `!d.filePath` (no file) instead of `d.reviewStatus === "pending_client"`
- **"rejected"** and **"in_review"** filters require `d.filePath` to be truthy AND matching status — so rejected documents whose files were deleted (filePath is null) get excluded

### Root Cause
The filter conflates "has a file" with review status, instead of relying on the `reviewStatus` field which already correctly reflects the document's state.

### Fix

**File: `src/pages/migration/ApplicationDetail.tsx` (~lines 1746-1758)**

Replace the filter logic to use `reviewStatus` consistently:

```typescript
const filteredDocuments = useMemo(() => {
  const conditionalDisabled = documents.filter(d => d.requirementType === "conditional" && !d.isApplicable);

  if (reviewFilter === "all") return [...applicableDocuments, ...conditionalDisabled];
  return [
    ...applicableDocuments.filter(d => d.reviewStatus === reviewFilter),
    ...conditionalDisabled,
  ];
}, [documents, applicableDocuments, reviewFilter]);
```

This single change makes all filter options — Pending Client, Ready to Review, Approved, Rejected — work correctly by matching on the actual `reviewStatus` field.

