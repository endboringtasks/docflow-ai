
# Plan: Fix Focus Ring Clipping in Create Application Dialog

## Problem Identified
The "Create Application" dialog has the same focus ring clipping issue as the "Create New Client" dialog. The blue focus ring on the "Client" select dropdown is being cut off on the left side.

### Root Cause
The scrollable form container on line 860 of `src/pages/migration/Applications.tsx` uses:
```html
<div className="space-y-4 py-4 overflow-y-auto max-h-[60vh] pr-4">
```

The `overflow-y-auto` clips the focus ring which extends 2px outside the element bounds (due to `ring-offset-2` on SelectTrigger).

## Solution
Apply the same fix used for the Clients page - add horizontal padding with matching negative margins to provide space for the focus ring without affecting visual alignment.

## Implementation

### File: `src/pages/migration/Applications.tsx`

| Line | Current | After |
|------|---------|-------|
| 860 | `overflow-y-auto max-h-[60vh] pr-4` | `overflow-y-auto max-h-[60vh] px-1 -mx-1` |

The Edit Application dialog (line 1232) doesn't have `overflow-y-auto`, so it should not experience the same clipping issue.

## Technical Details
- `px-1` adds 4px (0.25rem) of horizontal padding, providing room for the 2px focus ring offset
- `-mx-1` adds negative horizontal margins to maintain visual alignment with the dialog edges
- The vertical spacing and scrolling behavior remain unchanged

## Files to Modify
| File | Changes |
|------|---------|
| `src/pages/migration/Applications.tsx` | Update the Create Application dialog container class on line 860 |

## Expected Result
- Focus ring on all Select components (Client, Country, Category, etc.) will be fully visible
- No clipping on left, right, or any edge
- Scrolling and visual layout remain unchanged
