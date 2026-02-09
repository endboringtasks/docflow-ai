
# Plan: Change Document Card Background Color from Green to Light Blue

## Problem Identified
The completed document cards in the Client Portal currently display with a green background color (`bg-green-50` with `border-green-200`). The user wants to change this to a light blue color (`#f4f8fd`).

## Solution
Update the background and border colors for completed document cards in the Client Portal from green (`bg-green-50`/`border-green-200`) to light blue (`#f4f8fd`).

### Approach
Since `#f4f8fd` is not a standard Tailwind color, we have two options:

**Option A (Preferred)**: Use Tailwind's `arbitrary value` syntax with the hex color directly in the className
- This keeps the styling inline and doesn't require theme modifications
- Example: `bg-[#f4f8fd]` and appropriate border color

**Option B**: Add the custom color to the Tailwind theme configuration
- More maintainable if the color is used in multiple places
- Requires updating `tailwind.config.ts`

**Option A is recommended** because the color appears to only be used in this one location.

## Implementation

### File: `src/pages/client-portal/ClientPortal.tsx`

**Location**: Line 1042 in the className ternary expression

**Current styling**:
```typescript
doc.is_completed 
  ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
  : ...
```

**Updated styling**:
```typescript
doc.is_completed 
  ? "bg-[#f4f8fd] dark:bg-slate-900/30 border-[#e0ecf8] dark:border-slate-700"
  : ...
```

### Details
- `bg-[#f4f8fd]` - Light blue background color (user-specified hex)
- `border-[#e0ecf8]` - Slightly darker light blue border for visual definition
- `dark:bg-slate-900/30` - Adjusted dark mode background (keeping the dark mode look coherent)
- `dark:border-slate-700` - Adjusted dark mode border

## Files to Modify
| File | Changes |
|------|---------|
| `src/pages/client-portal/ClientPortal.tsx` | Update line 1042 className to use light blue (`#f4f8fd`) instead of green |

## Expected Result
- Completed document cards will display with the new light blue background (`#f4f8fd`)
- Border styling will be appropriately adjusted for visual consistency
- Dark mode styling will be coherent
- All other document statuses (pending, rejected, etc.) remain unchanged

