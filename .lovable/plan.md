

# Plan: Count Enabled Conditional Documents as Required

## Problem

When a conditional document (e.g., "Previous Visas") is enabled, it currently counts toward the "Optional" total. The user wants enabled conditional documents to count as "Required" instead.

## Fix

### File: `src/pages/migration/ApplicationDetail.tsx`

Revert the optional count back to only `'optional'` documents, and update the required count to also include `'conditional'` documents (which are only in `applicableDocuments` when enabled):

**Current (lines 1679-1682):**
```tsx
const requiredCount = applicableDocuments.filter(d => d.required || d.requirementType === 'required').length;
const requiredCompleted = applicableDocuments.filter(d => (d.required || d.requirementType === 'required') && d.completed).length;
const optionalCount = applicableDocuments.filter(d => d.requirementType === 'optional' || d.requirementType === 'conditional').length;
const optionalCompleted = applicableDocuments.filter(d => (d.requirementType === 'optional' || d.requirementType === 'conditional') && d.completed).length;
```

**Updated:**
```tsx
const requiredCount = applicableDocuments.filter(d => d.required || d.requirementType === 'required' || d.requirementType === 'conditional').length;
const requiredCompleted = applicableDocuments.filter(d => (d.required || d.requirementType === 'required' || d.requirementType === 'conditional') && d.completed).length;
const optionalCount = applicableDocuments.filter(d => d.requirementType === 'optional').length;
const optionalCompleted = applicableDocuments.filter(d => d.requirementType === 'optional' && d.completed).length;
```

Since conditional documents only appear in `applicableDocuments` when enabled, toggling ON increases the required count and toggling OFF decreases it.

## Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | 1679-1682 | Move conditional from optional to required count |

