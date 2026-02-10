

# Plan: Remove Strikethrough from Document Checklist

## Problem

Document names in the checklist show a strikethrough style when marked as completed. The user wants this removed so all document names display consistently without strikethrough.

## Changes

### File: `src/pages/migration/ApplicationDetail.tsx` (line 2200)

Remove the conditional `line-through text-muted-foreground` class from the document name span.

**Before:**
```tsx
<span className={doc.completed ? "line-through text-muted-foreground" : ""}>
```

**After:**
```tsx
<span>
```

This removes the strikethrough and muted text color that was applied when a document was marked as completed, keeping all document names styled the same regardless of completion status.

### Files to Modify

| File | Line | Change |
|------|------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | 2200 | Remove `line-through text-muted-foreground` conditional class |

