
# Fix Mobile Dialogs - Cancel and Create Buttons Not Visible

## Problem

On iPhone, when creating a new client or new application, the Cancel and Create buttons are not visible because the form content exceeds the screen height and there's no scrolling enabled.

## Root Cause

The `DialogContent` in both dialogs has no maximum height constraint. On mobile devices:
- **Create Client Dialog**: 7+ form fields push the buttons below the viewport
- **Create Application Dialog**: Multiple selects + ApplicantSelector component make it even taller

## Solution

Add a scrollable container for the form content while keeping the header and footer (buttons) fixed and always visible.

## Changes Required

### 1. Update Dialog Component (Global Fix)

| File | Change |
|------|--------|
| `src/components/ui/dialog.tsx` | Add `max-h-[90vh]` and `overflow-y-auto` to `DialogContent` for proper mobile sizing |

```typescript
// Line 38-40: Add max-height and flex layout
className={cn(
  "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg max-h-[90vh] translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 overflow-hidden flex flex-col data-[state=open]:animate-in ...",
  className,
)}
```

### 2. Update Create Client Dialog

| File | Change |
|------|--------|
| `src/pages/migration/Clients.tsx` | Wrap form content in scrollable div, use DialogFooter for buttons |

**Line 514** - Make form content scrollable:
```typescript
<div className="space-y-4 py-4 overflow-y-auto max-h-[60vh] pr-2">
```

**Line 612** - Use DialogFooter for consistent button placement:
```typescript
<DialogFooter className="flex-shrink-0 pt-4 border-t">
  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
    Cancel
  </Button>
  <Button variant="gradient" onClick={handleCreateClient} ...>
    ...
  </Button>
</DialogFooter>
```

### 3. Update Create Application Dialog

| File | Change |
|------|--------|
| `src/pages/migration/Applications.tsx` | Wrap form content in scrollable div, use DialogFooter |

**Line 859** - Make form content scrollable:
```typescript
<div className="space-y-4 py-4 overflow-y-auto max-h-[60vh] pr-2">
```

**Line 1031** - Use DialogFooter:
```typescript
<DialogFooter className="flex-shrink-0 pt-4 border-t">
  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
    Cancel
  </Button>
  <Button onClick={handleCreateApplication} ...>
    ...
  </Button>
</DialogFooter>
```

## Visual Result

**Before (Mobile)**:
- Form fields visible
- Buttons hidden below screen

**After (Mobile)**:
- Dialog header stays at top
- Form fields scroll within container
- Cancel and Create buttons always visible at bottom

## Files to Modify

1. `src/components/ui/dialog.tsx` - Add max-height constraint
2. `src/pages/migration/Clients.tsx` - Scrollable form + DialogFooter
3. `src/pages/migration/Applications.tsx` - Scrollable form + DialogFooter

## Technical Notes

- Using `max-h-[60vh]` for form content ensures ~30% space remains for header + footer
- `overflow-y-auto` enables scrolling only when needed
- `pr-2` adds padding for scrollbar visibility
- `DialogFooter` provides consistent responsive button layout
- `flex-shrink-0` prevents footer from being compressed
