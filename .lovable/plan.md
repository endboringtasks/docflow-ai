

# Plan: Fix Category, Applicant, and Required Counts When Toggling Conditional Documents

## Problem

When a conditional document (e.g., "Previous Visas") is disabled, it still appears in the checklist (correct), but the category count (e.g., "0/4"), applicant count (e.g., "0/22"), and top-level required/optional counts (e.g., "0/29 complete") include the disabled document in the total. When toggling enable/disable, these counts should update to reflect only applicable documents.

## Root Cause

The category and applicant badge counts are computed from `groupedByApplicantType`, which is built from `filteredDocuments`. Since the previous fix added disabled conditional documents to `filteredDocuments`, they are now included in the `docs.length` and `flat().length` totals used for the badges.

## Fix

### File: `src/pages/migration/ApplicationDetail.tsx`

**1. Category count badge (line 2184)** -- filter out non-applicable documents from the count:

```tsx
// Before:
{docs.filter(d => d.completed).length}/{docs.length}

// After:
{docs.filter(d => d.isApplicable && d.completed).length}/{docs.filter(d => d.isApplicable).length}
```

**2. Applicant count badge (lines 2170-2171)** -- same filter:

```tsx
// Before:
{Object.values(groupedByApplicantType[applicantType]).flat().filter(d => d.completed).length}/
{Object.values(groupedByApplicantType[applicantType]).flat().length}

// After:
{Object.values(groupedByApplicantType[applicantType]).flat().filter(d => d.isApplicable && d.completed).length}/
{Object.values(groupedByApplicantType[applicantType]).flat().filter(d => d.isApplicable).length}
```

The top-level required/optional counts (lines 1678-1682) already use `applicableDocuments` which filters by `isApplicable`, so those are correct and need no changes.

## Result

- Disabling a conditional document decreases the category, applicant, and overall totals
- Enabling it increases them back
- Disabled conditional documents remain visible in the list with their toggle
- Top-level required/optional counts remain correct (already scoped to applicable)
