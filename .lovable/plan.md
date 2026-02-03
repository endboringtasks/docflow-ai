

# Fix Document Order in Client Portal

## Problem

Documents in the Client Portal are displayed in a different order than the Application page. From the screenshot:

| View | Order |
|------|-------|
| **Application page** | CoE → Diploma → Diploma (Translation) → Professional Certifications |
| **Client Portal** | Professional Certifications → CoE → Diploma → Diploma (Translation) |

## Root Cause

The Client Portal sorts documents by **raw** `document_name` which includes category/requirement tags like `[Educational Documents:optional] Professional Certifications`.

When sorting:
- `[Educational Documents:optional]...` comes **before** `[Educational Documents:required]...` (alphabetically, 'o' < 'r')
- This causes "Professional Certifications" (optional) to appear before "CoE" and "Diploma" (required)

The Application page uses `parseDocumentName()` to extract clean display names **before** sorting, so it correctly sorts by actual document name.

## Solution

Apply the same sanitization regex to document names **before** sorting in ClientPortal.tsx.

## Changes Required

### ClientPortal.tsx (Line 695)

Create a helper function and use it for sorting:

**Add sanitization helper** (around line 90):
```typescript
// Sanitize document name for sorting (remove category tags)
const sanitizeForSort = (name: string): string => {
  return name
    .replace(/\s*\[[^\]]*:(?:required|optional)\]\s*/gi, " ")
    .replace(/\s*\(Translation\)\s*/gi, "")
    .trim();
};
```

**Update sorting** (line 695):
```typescript
// Current:
const originals = docs.filter(d => !d.translation_of_id)
  .sort((a, b) => a.document_name.localeCompare(b.document_name));

// Fixed:
const originals = docs.filter(d => !d.translation_of_id)
  .sort((a, b) => sanitizeForSort(a.document_name).localeCompare(sanitizeForSort(b.document_name)));
```

## Result

After this change, documents will sort by their clean display names:

| Before Sort | After Sanitization | Final Order |
|-------------|--------------------|-------------|
| `[Educational:optional] Professional Certifications` | `Professional Certifications` | 3rd |
| `[Educational:required] CoE` | `CoE` | 1st |
| `[Educational:required] Diploma` | `Diploma` | 2nd |

**Final order**: CoE → Diploma → Diploma (Translation) → Professional Certifications

This matches the Application page order.

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/client-portal/ClientPortal.tsx` | Add `sanitizeForSort()` helper and use it in sorting |

