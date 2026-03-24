

## Remove File Type Badges from Application View

### Problem
The application view shows file type badges (PDF, Image, Word, etc.) next to document attachments, which the user wants removed for a cleaner look.

### Change

**File: `src/pages/migration/ApplicationDetail.tsx`**

1. **Remove the file type badge block** (~lines 2513-2520): Delete the `{attachment.file_type && (() => { ... })()}` block that renders the Badge with `getFileTypeBadge`.

2. **Remove unused import** (~line 5): Remove `getFileTypeBadge` from the imports since it will no longer be used.

