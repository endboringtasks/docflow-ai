
# Remove "If Applicable" Badge from Document Checklists

## Problem

The "If Applicable" badge is showing next to conditional documents on both:
1. The internal application detail page (`ApplicationDetail.tsx`)
2. The client portal (`ClientPortal.tsx`)

The user wants these badges removed from both views.

## Solution

Remove the badge rendering code for `requirement_type === "conditional"` from both pages while keeping the rest of the document display logic intact.

## Files to Change

| File | Lines | Change |
|------|-------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | 1966-1979 | Remove the "If Applicable" badge with its tooltip wrapper |
| `src/pages/client-portal/ClientPortal.tsx` | 1006-1019 | Remove the "If Applicable" badge with its tooltip wrapper |

## Code Changes

### ApplicationDetail.tsx (lines 1966-1979)
Remove this block:
```tsx
{doc.requirementType === "conditional" && (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={`text-xs border-amber-500 text-amber-600 dark:text-amber-400 ${!doc.isApplicable ? 'opacity-50' : ''}`}>
          If Applicable
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="text-xs">{doc.applicabilityCondition || "Submit this document if it applies to this case"}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)}
```

### ClientPortal.tsx (lines 1006-1019)
Remove this block:
```tsx
{doc.requirement_type === "conditional" && (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 dark:text-amber-400">
          If Applicable
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="text-xs">{doc.applicability_condition || "Submit this document if it applies to your situation"}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)}
```

## Result

After the changes:
- Documents will no longer show the "If Applicable" badge
- Other badges like "Pending Client", "Has Translation", "Optional", and file count badges will remain
- The applicability toggle functionality in the admin area remains unchanged
