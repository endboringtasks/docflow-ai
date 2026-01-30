
# Clean Up Document File Naming in Google Drive

## The Issue

Document names stored in the database include category tags:
```
[Educational Documents:required] CoE
```

When creating file names for Google Drive, the current code just replaces non-alphanumeric characters with underscores:
```
SANTOS_Anderson__Educational_Documents_required__CoE.pdf
```

**Problems:**
1. The `[Category:required]` tag is included in the filename
2. Double underscores appear where brackets and colons are replaced

## Solution

Add a sanitization step to:
1. **Strip the category tag prefix** (e.g., `[Educational Documents:required]`)
2. **Collapse multiple underscores** into single underscores
3. **Trim leading/trailing underscores**

**Expected result:**
```
SANTOS_Anderson_CoE.pdf
```

## Changes Required

### Files to Update

| File | Location |
|------|----------|
| `supabase/functions/client-portal-upload/index.ts` | Lines 537-540 |
| `supabase/functions/internal-upload/index.ts` | Lines 509-512 |

### New Sanitization Logic

```typescript
// Strip category prefix pattern like "[Category:required] " or "[Category:optional] "
const rawDocName = docData.document_name
  .replace(/^\[[^\]]+:(required|optional)\]\s*/i, '')  // Remove [Category:required/optional] prefix
  .replace(/^\[Custom\]\s*/i, '')                       // Remove [Custom] prefix

// Sanitize remaining name
const cleanDocName = rawDocName
  .replace(/[^a-zA-Z0-9]/g, '_')   // Replace special chars with underscore
  .replace(/_+/g, '_')              // Collapse multiple underscores
  .replace(/^_|_$/g, '')            // Trim leading/trailing underscores
```

### Before vs After

| Input Document Name | Current Output | New Output |
|---------------------|----------------|------------|
| `[Educational Documents:required] CoE` | `_Educational_Documents_required__CoE` | `CoE` |
| `[Identity:required] Passport` | `_Identity_required__Passport` | `Passport` |
| `[Custom] Birth Certificate` | `_Custom__Birth_Certificate` | `Birth_Certificate` |
| `Tax Returns 2024` | `Tax_Returns_2024` | `Tax_Returns_2024` |

### Full Filename Examples

| Client | Document | Current | New |
|--------|----------|---------|-----|
| Anderson Ribeiro dos Santos | `[Educational Documents:required] CoE` | `SANTOS_Anderson__Educational_Documents_required__CoE.pdf` | `SANTOS_Anderson_CoE.pdf` |
| Maria Silva | `[Identity:required] Passport` | `SILVA_Maria__Identity_required__Passport.pdf` | `SILVA_Maria_Passport.pdf` |
