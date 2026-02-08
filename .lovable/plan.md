
# Plan: Fix Focus Ring Clipping on Select Components

## Problem Identified
The blue focus ring on the Client Type select dropdown is being cut off on the left side. This occurs because:

1. The form container uses `overflow-y-auto` to enable scrolling
2. The SelectTrigger uses `ring-offset-2` which creates a focus ring that extends 2px **outside** the element bounds
3. The overflow clipping from the parent container cuts off the ring

## Solution
There are two approaches to fix this:

### Approach A: Add padding to the scrollable container (Recommended)
Add small padding to the scrollable form area so the focus rings have room to render without being clipped.

### Approach B: Use inset focus styling instead of ring-offset
Change the SelectTrigger to use an inset focus style (like `ring-inset`) that renders inside the element instead of outside.

**Approach A is preferred** because it keeps the visual styling consistent with other form elements and is less invasive.

## Implementation

### File: `src/pages/migration/Clients.tsx`

Update the scrollable form container on line 515 to add padding that accommodates the focus ring:

| Before | After |
|--------|-------|
| `overflow-y-auto max-h-[60vh] pr-2` | `overflow-y-auto max-h-[60vh] px-1 -mx-1` |

The negative margin (`-mx-1`) keeps the content aligned with the dialog edges while the padding (`px-1`) provides space for the focus ring.

This same fix should be applied to the Edit Client dialog as well.

## Expected Result
- Focus ring will be fully visible on all sides of the Select component
- No clipping on left, right, or any other edge
- Scrolling behavior remains unchanged
- Visual consistency maintained across all form fields
