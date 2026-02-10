

# Plan: Clean Up Application Detail Stats

## Changes

### File: `src/pages/migration/ApplicationDetail.tsx`

**1. Add optional completed count (after line 1681):**

```tsx
const optionalCompleted = applicableDocuments.filter(d => d.requirementType === 'optional' && d.completed).length;
```

**2. Replace lines 1900-1922** -- Remove the "Documents" block, keep Required and Optional inline, and show completion for Optional too:

```tsx
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
      <p className="font-medium">{optionalCompleted}/{optionalCount} complete</p>
    </div>
  </div>
)}
```

## Result

- "Documents" stat removed
- Required shows: `0/28 complete`
- Optional shows: `0/1 complete` (same format as Required)
- Both stats appear on the same row

## File to Modify

| File | Change |
|------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | Add `optionalCompleted` variable; remove "Documents" block; update Optional to show completion count |

