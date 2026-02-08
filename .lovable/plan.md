
# Plan: Fix Client Type Box Alignment

## Problem Identified
In the "Create New Client" and "Edit Client" dialogs, the **Client Type** select dropdown box appears wider/misaligned compared to other form inputs (First Name, Last Name, Email, Phone, etc.).

### Root Cause
The `SelectTrigger` component uses `justify-between` flexbox property on line 20 of `src/components/ui/select.tsx`, which creates space between the text and the chevron icon. This, combined with the icon and padding, causes the select box to appear wider than standard input elements.

### Visual Difference
- **Input elements**: Tight, compact
- **Select element**: Appears wider due to `justify-between` spacing and icon handling

## Solution
The issue is that the SelectTrigger's `justify-between` class is creating unnecessary space. However, looking more carefully at the screenshot and the form structure, the real issue is likely that the `SelectTrigger` is using default flexbox alignment that differs from how standard inputs align their content.

The cleanest solution is to ensure the SelectTrigger aligns its content the same way as standard inputs by modifying how the space between the text and icon is managed. 

### Changes Required

**File: `src/components/ui/select.tsx`**

Modify the `SelectTrigger` component (lines 13-30) to use `items-center` properly and adjust the spacing so it matches input field alignment:

```typescript
// Current (line 20):
"flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",

// Changed to use justify-end instead of justify-between, with margin-left: auto on the icon:
// - Remove justify-between
// - Use flex-1 for the SelectValue to take available space
// - Add ml-auto to the icon to push it to the right

// Better approach: Keep justify-between but ensure the Select text is left-aligned
// Actually, the issue is the icon is creating uneven spacing
// The fix is to ensure proper gap between text and icon, not justify-between
```

### Implementation Details

The SelectTrigger should be modified to:
1. Keep the flex layout but change `justify-between` to `items-center`
2. Add gap spacing between content sections
3. Ensure the icon is properly positioned without forcing extra space

**Specific change:**
- Replace `justify-between` with just `items-center` 
- Use gap or margin to control spacing between text and icon

**Result:** The SelectTrigger will align identically to Input elements, creating visual consistency in the form layout.

## Files to Modify
| File | Changes |
|------|---------|
| `src/components/ui/select.tsx` | Modify SelectTrigger flex alignment from `justify-between` to `items-center gap-2`, ensuring text and icon are properly spaced |

## Expected Outcome
- Client Type select box will align left just like First Name, Last Name, and other input fields
- Text will start at the same position as other inputs
- Consistent visual alignment across all form fields
- Icon remains on the right but with controlled spacing
