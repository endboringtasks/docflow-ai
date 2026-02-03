

# Fix: Client Select Box Cut Off on Right Side

## Problem

In the "Create Application" dialog, the client selector box is being cut off on the right side. This is visible when the select is focused and shows its focus ring.

## Root Cause

The scrollable container wrapping the form fields has `pr-2` (8px right padding), but this is insufficient to accommodate:
1. The focus ring on the Select component (which extends beyond the element boundary)
2. The scrollbar that appears when content overflows

**Current code (line 860):**
```typescript
<div className="space-y-4 py-4 overflow-y-auto max-h-[60vh] pr-2">
```

## Solution

Increase the right padding from `pr-2` to `pr-4` to provide adequate spacing for both the focus ring and potential scrollbar.

## Change Required

**File**: `src/pages/migration/Applications.tsx` (Line 860)

| Before | After |
|--------|-------|
| `pr-2` | `pr-4` |

```typescript
// Before:
<div className="space-y-4 py-4 overflow-y-auto max-h-[60vh] pr-2">

// After:
<div className="space-y-4 py-4 overflow-y-auto max-h-[60vh] pr-4">
```

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/migration/Applications.tsx` | Change `pr-2` to `pr-4` on line 860 |

