
# Fix: Remove `[Category:optional]` Prefix from Document Names

## Problem

In the client portal, document names display a prefix like `[Identity Documents:optional]` before the actual document name (e.g., "Name Change Certificate"). This happens because the current regex only strips the `:required` pattern but not `:optional`.

**Current regex:**
```javascript
doc.document_name.replace(/\s*\[[^\]]*:required\]\s*/gi, " ").trim()
```

This only matches patterns like `[Category:required]` but NOT `[Category:optional]`.

## Solution

Update the regex to match both `:required` and `:optional` patterns using an alternation:

```javascript
doc.document_name.replace(/\s*\[[^\]]*:(?:required|optional)\]\s*/gi, " ").trim()
```

## Files to Change

| File | Line | Change |
|------|------|--------|
| `src/pages/client-portal/ClientPortal.tsx` | 1003 | Update regex for document name display |
| `src/pages/client-portal/ClientPortal.tsx` | 1081 | Update regex for description display |

## Technical Details

The regex breakdown:
- `\s*` - Match optional leading whitespace
- `\[` - Match opening bracket
- `[^\]]*` - Match any characters except closing bracket (the category name)
- `:(?:required|optional)` - Match either `:required` or `:optional` (non-capturing group)
- `\]` - Match closing bracket
- `\s*` - Match optional trailing whitespace
- `gi` - Global and case-insensitive flags

## Result

After the fix, documents will display as:
- **Before:** `[Identity Documents:optional] Name Change Certificate`
- **After:** `Name Change Certificate`
