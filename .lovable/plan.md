
# Plan: Fix Nationality Select Keyboard Accessibility

## Problem Identified
The Nationality select dropdown only opens when clicking with a mouse. It does not respond to:
1. **Tab + typing letters** - should open the dropdown and start filtering
2. **Arrow Down key** - should open the dropdown
3. **Enter/Space keys** - should toggle the dropdown

This is a significant accessibility issue as keyboard-only users cannot access the nationality list.

## Root Cause
The `NationalitySelect` component uses a `Popover` with a `Button` as the trigger, but relies entirely on the default Radix Popover behavior which only opens on click events. The component needs explicit keyboard event handlers to open the popover on:
- **Arrow Down / Arrow Up** - Standard combobox keyboard navigation
- **Enter / Space** - Standard button activation (Radix handles this)
- **Any letter key** - Should open and start searching

## Solution
Add an `onKeyDown` handler to the trigger Button that:
1. Opens the popover when pressing Arrow Down, Arrow Up, or any printable character
2. Lets Enter/Space work naturally (Radix Popover already handles these)

## Implementation

### File: `src/components/ui/nationality-select.tsx`

Add keyboard handling to the Button trigger:

```typescript
// Add onKeyDown handler to open popover on arrow keys or typing
const handleKeyDown = (e: React.KeyboardEvent) => {
  // Open on arrow down/up
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    setOpen(true);
  }
  // Open on any printable character (for type-ahead)
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    setOpen(true);
  }
};

// Apply to Button
<Button
  variant="outline"
  role="combobox"
  aria-expanded={open}
  disabled={disabled}
  onKeyDown={handleKeyDown}
  className={...}
>
```

### Detailed Changes

| Line | Current | After |
|------|---------|-------|
| 35-36 | `const [open, setOpen] = React.useState(false);` | Add keyboard handler function after this |
| 44-64 | Button without onKeyDown | Add `onKeyDown={handleKeyDown}` prop |

### Technical Details

The keyboard handler will:
1. **ArrowDown/ArrowUp**: Prevent default scroll behavior and open the popover
2. **Printable characters**: Open popover so the user can immediately start searching (the cmdk CommandInput will receive focus and capture the keystrokes)

The Enter and Space keys already work for Radix Popover triggers, but the issue is they may not be working due to the Button wrapper - we'll add explicit handling if needed.

## Expected Result
- Users can Tab to the Nationality field and press Arrow Down to open
- Users can Tab to the field and start typing to open and search
- Full keyboard accessibility matching standard combobox behavior
- Mouse functionality remains unchanged

## Files to Modify
| File | Changes |
|------|---------|
| `src/components/ui/nationality-select.tsx` | Add `onKeyDown` handler to Button trigger for keyboard accessibility |
