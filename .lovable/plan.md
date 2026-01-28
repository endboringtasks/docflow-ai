

# Rename Toggle Labels from "N/A - Applies" to "Disable - Enable"

## Problem

The applicability toggle for conditional documents currently shows "N/A" and "Applies" as labels. The user wants these renamed to "Disable" and "Enable" for clearer understanding of what the toggle does (disable/enable the document requirement).

## Solution

Update the toggle label text in ApplicationDetail.tsx from:
- "N/A" → "Disable"
- "Applies" → "Enable"

## File to Change

| File | Lines | Change |
|------|-------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | 2119-2131 | Rename toggle labels |

## Code Changes

```tsx
// Before (lines 2119-2131):
<span className={`text-xs ${!doc.isApplicable ? 'text-muted-foreground font-medium' : 'text-muted-foreground/60'}`}>
  N/A
</span>
<Switch ... />
<span className={`text-xs ${doc.isApplicable ? 'text-amber-600 font-medium' : 'text-muted-foreground/60'}`}>
  Applies
</span>

// After:
<span className={`text-xs ${!doc.isApplicable ? 'text-muted-foreground font-medium' : 'text-muted-foreground/60'}`}>
  Disable
</span>
<Switch ... />
<span className={`text-xs ${doc.isApplicable ? 'text-amber-600 font-medium' : 'text-muted-foreground/60'}`}>
  Enable
</span>
```

## Visual Result

**Before:**
```
[Divorce Certificate]  [ N/A ○──── Applies ]
```

**After:**
```
[Divorce Certificate]  [ Disable ○──── Enable ]
```

This makes the toggle action clearer - "Disable" means the document requirement is disabled (not needed), and "Enable" means it's enabled (required from the client).

