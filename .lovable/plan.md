
# Plan: Update Completed Document Card Background Color to #f4fbf6

## Problem Identified
The user wants to change the background color of completed document cards from the current light blue (`#f4f8fd`) to a slightly different shade (`#f4fbf6` - a more greenish/teal tint).

## Solution
Update the background color hex value and adjust the border color to maintain visual consistency with the new background tone.

## Implementation

### File: `src/pages/client-portal/ClientPortal.tsx`

**Location**: Line 1042 in the className ternary expression

**Current styling**:
```typescript
doc.is_completed 
  ? "bg-[#f4f8fd] dark:bg-slate-900/30 border-[#e0ecf8] dark:border-slate-700"
  : ...
```

**Updated styling**:
```typescript
doc.is_completed 
  ? "bg-[#f4fbf6] dark:bg-slate-900/30 border-[#e8f0eb] dark:border-slate-700"
  : ...
```

### Details
- `bg-[#f4fbf6]` - Updated light background color (user-specified hex) - slightly more greenish than the previous blue
- `border-[#e8f0eb]` - Adjusted border color to complement the new background tone (darker shade of the new background)
- Dark mode and other styling remain unchanged

## Files to Modify
| File | Changes |
|------|---------|
| `src/pages/client-portal/ClientPortal.tsx` | Update line 1042 to change background color from `#f4f8fd` to `#f4fbf6` and border from `#e0ecf8` to `#e8f0eb` |

## Expected Result
- Completed document cards will display with the new light greenish/teal background (`#f4fbf6`)
- Border color will be adjusted to maintain visual consistency
- All other styling and functionality remains unchanged
