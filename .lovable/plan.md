

# Plan: Include Enabled Conditional Documents in the Optional Count

## Problem

When a conditional document (e.g., "Previous Visas") is toggled to enabled, the "Required" and "Optional" counts in the Review Status section don't update. This is because conditional documents have `requirementType === 'conditional'`, which is excluded from both the required count (`requirementType === 'required'`) and the optional count (`requirementType === 'optional'`).

Enabled conditional documents end up in a counting blind spot -- they exist in `applicableDocuments` but are not reflected in any visible counter.

## Fix

### File: `src/pages/migration/ApplicationDetail.tsx`

Update the optional count calculation (lines 1681-1682) to also include enabled conditional documents:

**Before:**
```tsx
const optionalCount = applicableDocuments.filter(d => d.requirementType === 'optional').length;
const optionalCompleted = applicableDocuments.filter(d => d.requirementType === 'optional' && d.completed).length;
```

**After:**
```tsx
const optionalCount = applicableDocuments.filter(d => d.requirementType === 'optional' || d.requirementType === 'conditional').length;
const optionalCompleted = applicableDocuments.filter(d => (d.requirementType === 'optional' || d.requirementType === 'conditional') && d.completed).length;
```

Since conditional documents are only in `applicableDocuments` when `isApplicable` is true (i.e., the user explicitly enabled them), this means:
- Toggling a conditional document ON increases the optional count
- Toggling it OFF decreases it
- The required count remains unchanged (conditional docs are never "required")

## Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | 1681-1682 | Include `requirementType === 'conditional'` in optional count filters |
