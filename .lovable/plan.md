

# Rename "Has Translation" Badge to "Original"

## Problem

In the admin application detail page, documents that have a linked translation are marked with a "Has Translation" badge. The user wants this renamed to "Original" to better indicate that this is the original document (with its translation appearing right below it now).

## Solution

Update the badge text from "Has Translation" to "Original" in the ApplicationDetail.tsx file.

## File to Change

| File | Line | Change |
|------|------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | 2046 | Change "Has Translation" to "Original" |

## Code Change

```tsx
// Before (line 2046):
Has Translation

// After:
Original
```

The full context:
```tsx
{doc.requiresTranslation && !doc.translationOfId && (
  <Tooltip>
    <TooltipTrigger asChild>
      <Badge variant="outline" className="text-xs text-purple-600 border-purple-400 bg-purple-50 dark:bg-purple-950/30">
        <Link2 className="w-3 h-3 mr-1" />
        Original  {/* Changed from "Has Translation" */}
      </Badge>
    </TooltipTrigger>
    <TooltipContent>
      <p>A translation document was auto-created for this original</p>
    </TooltipContent>
  </Tooltip>
)}
```

## Visual Result

**Before:**
```
○ Divorce Certificate           ↔ Has Translation  ⏳ Pending Client
○ Divorce Certificate           文 Translation • NAATI Certified  ⏳ Pending Client
```

**After:**
```
○ Divorce Certificate           ↔ Original  ⏳ Pending Client
○ Divorce Certificate           文 Translation • NAATI Certified  ⏳ Pending Client
```

This creates a clearer visual pairing: "Original" followed by its "Translation".

