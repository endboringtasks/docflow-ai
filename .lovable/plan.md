

# Plan: Show Optional Document Count in Both Views

## Problem

The Application Detail page shows "28/28 required complete" but doesn't show how many optional documents exist. The Client Portal counts all documents (including optional) as one total number. Neither view gives a clear picture of required vs. optional.

## Solution

Add an optional document count display to both views, and fix the Client Portal to separate required from optional in its progress tracking.

## Changes

### 1. Client Portal (`src/pages/client-portal/ClientPortal.tsx`)

**Lines 693-700 -- Update counting logic:**

Split documents into required and optional counts:

```tsx
const requiredDocuments = documents.filter(d => d.requirement_type !== 'optional');
const optionalDocuments = documents.filter(d => d.requirement_type === 'optional');
const completedDocs = requiredDocuments.filter(d => 
  d.is_completed && 
  d.review_status !== 'pending_client' && 
  d.review_status !== 'rejected'
).length;
const totalDocs = requiredDocuments.length;
const optionalCount = optionalDocuments.length;
const progress = totalDocs > 0 ? (completedDocs / totalDocs) * 100 : 0;
```

**Line 930 -- Update badge display:**

Change from `{completedDocs}/{totalDocs} documents` to include optional count:

```tsx
<Badge variant="outline">
  {completedDocs}/{totalDocs} required{optionalCount > 0 ? ` + ${optionalCount} optional` : ''}
</Badge>
```

**Lines 1414-1416 -- Update submit confirmation dialog:**

Update to reference only required documents:

```tsx
<strong>{completedDocs}</strong> of <strong>{totalDocs}</strong> required documents uploaded.
{optionalCount > 0 && <> Plus <strong>{optionalCount}</strong> optional.</>}
```

### 2. Application Detail Page (`src/pages/migration/ApplicationDetail.tsx`)

**Lines 1677-1681 -- Add optional count:**

Add an `optionalCount` variable:

```tsx
const optionalCount = applicableDocuments.filter(d => !d.required && d.requirementType !== 'required').length;
```

**Lines 1900-1911 -- Update the stats display:**

Add optional count next to the existing Required stat:

```tsx
<div className="flex items-center gap-3">
  <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
  <div>
    <p className="text-sm text-muted-foreground">Documents</p>
    <p className="font-medium">{completedCount}/{applicableDocuments.length} completed</p>
  </div>
</div>
<div className="flex items-center gap-3">
  <Circle className="w-5 h-5 text-muted-foreground" />
  <div>
    <p className="text-sm text-muted-foreground">Required</p>
    <p className="font-medium">{requiredCompleted}/{requiredCount} complete</p>
  </div>
</div>
{optionalCount > 0 && (
  <div className="flex items-center gap-3">
    <Circle className="w-5 h-5 text-muted-foreground" />
    <div>
      <p className="text-sm text-muted-foreground">Optional</p>
      <p className="font-medium">{optionalCount} document{optionalCount !== 1 ? 's' : ''}</p>
    </div>
  </div>
)}
```

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/client-portal/ClientPortal.tsx` | Separate required/optional counts; update badge and submit dialog |
| `src/pages/migration/ApplicationDetail.tsx` | Add optional count variable and display it in stats section |

## Result

- Both views will show the same required count (28)
- Both views will indicate the number of optional documents (1)
- Progress bar and completion tracking only count required documents
- Optional documents remain visible and uploadable in both views

