
# Fix Category Order Consistency Between Application Page and Client Portal

## Summary

The category display order differs between the Application page and the Client Portal because they use different sorting approaches:
- **Client Portal**: Uses `.sort()` to alphabetically order categories
- **Application page**: Uses no sorting, relying on database insertion order

## Root Cause

| Location | Current Behavior |
|----------|-----------------|
| `src/pages/client-portal/ClientPortal.tsx` (line 935) | `const sortedCategories = Object.keys(categories).sort();` - Alphabetical order |
| `src/pages/migration/ApplicationDetail.tsx` (line 2020) | `Object.entries(groupedByApplicantType[applicantType]).map(...)` - No explicit sorting |

## Solution

Apply the same alphabetical sorting to the Application page that is already used in the Client Portal. This ensures both views display categories in the same predictable order.

## Changes Required

### File to Modify

| File | Change |
|------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | Add alphabetical sorting before rendering categories |

### Implementation

Change the categories rendering from:

```typescript
{Object.entries(groupedByApplicantType[applicantType]).map(([category, docs]) => (
```

To:

```typescript
{Object.entries(groupedByApplicantType[applicantType])
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([category, docs]) => (
```

This adds `.sort(([a], [b]) => a.localeCompare(b))` which sorts the category entries alphabetically by their key (the category name) before mapping them to UI elements.

## Result

After this change, both views will display categories in the same alphabetical order:
- Educational Documents
- Employment Records
- Financial Documents
- Health & Medical
- Identity Documents
- Legal Documents
- Supporting Evidence
- Travel Documents

## Alternative Consideration

If a specific business-defined order is preferred (e.g., Identity first, then Travel, then Educational), a predefined category order constant could be created and shared between both files. However, alphabetical sorting is simpler and already in use in the Client Portal.
