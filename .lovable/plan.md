
# Plan: Fix Sidebar Layout - Always Visible Bottom Section

## Overview
Update the AppLayout sidebar to ensure Billing, Settings, and Sign out are always visible without scrolling, and make the sidebar fixed while the main content area scrolls independently.

## Current Issues
1. The navigation section uses `flex-1` which pushes bottom items off-screen on shorter viewports
2. On desktop, the sidebar is `static` instead of `fixed`, so it scrolls with the page
3. Users must scroll down within the sidebar to access Billing, Settings, and Sign out

## Solution

### Layout Structure Changes

```text
+------------------+--------------------------------+
|                  |                                |
|  SIDEBAR (fixed) |     MAIN CONTENT (scrolls)    |
|  - Logo          |     - Header (sticky)         |
|  - Company       |     - Page Content            |
|  - Nav (scroll   |                                |
|    if needed)    |                                |
|  - Bottom items  |                                |
|    (always       |                                |
|    visible)      |                                |
|                  |                                |
+------------------+--------------------------------+
```

### Implementation

1. **Make sidebar fixed on desktop** - Change from `lg:static` to remain `fixed` on all screen sizes, with proper positioning

2. **Add left margin to main content** - Offset main content by sidebar width (16rem/256px) on desktop

3. **Make navigation scrollable** - Add `overflow-y-auto` to the nav section so if there are many items, only that section scrolls (not the whole sidebar)

4. **Keep bottom section pinned** - The bottom section with Billing, Settings, Sign out already uses natural flex layout, but ensure it never gets pushed off-screen

## Technical Changes

### File: `src/components/layout/AppLayout.tsx`

| Section | Before | After |
|---------|--------|-------|
| Sidebar `aside` | `fixed lg:static` | `fixed` (always fixed) |
| Sidebar height | Implicit | `h-screen` (full viewport height) |
| Main wrapper | `flex` only | Add `lg:pl-64` (padding-left for sidebar width) |
| Navigation `nav` | `flex-1` | `flex-1 overflow-y-auto` (scrollable if needed) |
| Bottom section | Normal flow | `mt-auto` and `shrink-0` to ensure it stays at bottom |

### Pseudo-code Changes

```typescript
// Sidebar: always fixed, full height
<aside className="fixed inset-y-0 left-0 z-50 w-64 h-screen bg-sidebar border-r flex flex-col">
  {/* Logo - shrink-0 */}
  <div className="shrink-0 p-6 border-b">...</div>
  
  {/* Company Switcher - shrink-0 */}
  <div className="shrink-0 p-4 border-b">...</div>
  
  {/* Navigation - flex-1 and scrollable */}
  <nav className="flex-1 overflow-y-auto p-4 space-y-1">...</nav>
  
  {/* Bottom section - shrink-0, always visible */}
  <div className="shrink-0 p-4 border-t mt-auto space-y-1">...</div>
</aside>

// Main content: offset by sidebar width
<main className="flex-1 flex flex-col min-h-screen lg:ml-64">
  ...
</main>
```

## Visual Result
- Billing, Settings, and Sign out will always be visible at the bottom
- If navigation items exceed available space, only the nav section scrolls
- Main content area scrolls independently
- Sidebar remains fixed in place like Make.com

## Mobile Behavior
- No change to mobile behavior (sidebar slides in/out as overlay)
- Mobile already uses fixed positioning for the sidebar

## Files to Modify
| File | Changes |
|------|---------|
| `src/components/layout/AppLayout.tsx` | Update sidebar and main content layout classes |
