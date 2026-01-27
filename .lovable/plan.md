

## Fix Remaining Duplicate Document Initialization in Applications.tsx

### Problem Summary

The previous fix removed document initialization from `ClientDetail.tsx` but missed the identical initialization logic in `Applications.tsx`. When creating an application from the Applications list:

1. `Applications.tsx` inserts documents immediately in `onSuccess` (lines 395-498)
2. User navigates to `ApplicationDetail.tsx` 
3. `ApplicationDetail.tsx` also tries to initialize (sometimes winning the race against the first batch appearing in the database)

Result: Documents created twice, ~8 seconds apart.

---

### Solution

Remove the document template copying logic from `Applications.tsx` `onSuccess`, matching what was done for `ClientDetail.tsx`. This makes `ApplicationDetail.tsx` the **single source of truth** for document initialization.

---

### Changes

| File | Action |
|------|--------|
| `src/pages/migration/Applications.tsx` | Remove document template copying from `onSuccess` (lines 395-498) |

---

### Code to Remove

In `src/pages/migration/Applications.tsx`, delete lines 395-498 (the entire document template copying block):

```typescript
onSuccess: async (data) => {
  // DELETE THIS ENTIRE BLOCK (lines 396-498):
  // Copy document templates to document_checklist based on linked application types
  // try {
  //   if (data.visa_type_id && currentCompany?.id) {
  //     ...
  //   }
  // } catch (templateError) {
  //   console.error("Failed to copy document templates:", templateError);
  // }

  // KEEP everything after line 498 (webhook dispatch, applicant insertion, etc.)
  // Dispatch webhook for visa_application.created event
  try {
    // ... existing webhook code ...
  }
```

The `onSuccess` should start directly with the webhook dispatch code (currently line 500).

---

### Cleanup Existing Duplicates

After fixing the code, we need to clean up the existing duplicates in the database. Here's a SQL script to run in the Supabase SQL Editor (targeting Live environment):

```sql
-- Preview: See which duplicates would be deleted (run first to verify)
WITH ranked AS (
  SELECT 
    id,
    visa_application_id,
    document_name,
    applicant_type,
    age_condition,
    coalesce(translation_of_id::text, '') as trans_key,
    created_at,
    is_applicable,
    ROW_NUMBER() OVER (
      PARTITION BY visa_application_id, document_name, applicant_type, 
                   age_condition, coalesce(translation_of_id::text, '')
      ORDER BY 
        -- Prefer documents with is_applicable = true, then earliest created
        is_applicable DESC,
        created_at ASC
    ) as rn
  FROM public.document_checklist
)
SELECT id, visa_application_id, document_name, is_applicable, created_at, rn
FROM ranked 
WHERE rn > 1
ORDER BY visa_application_id, document_name;

-- Actual cleanup: Delete duplicates (keep the one with is_applicable=true or earliest)
WITH ranked AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY visa_application_id, document_name, applicant_type, 
                   age_condition, coalesce(translation_of_id::text, '')
      ORDER BY 
        is_applicable DESC,
        created_at ASC
    ) as rn
  FROM public.document_checklist
)
DELETE FROM public.document_checklist
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
```

---

### Why This Works

1. **Single initialization path**: Only `ApplicationDetail.tsx` handles document creation
2. **Race condition protection**: Already has `useRef` guard + database count check
3. **Consistent behavior**: Whether creating from Clients page or Applications page, documents are always initialized when viewing the application detail

---

### Affected Applications

Based on database analysis, these applications have duplicates and will be cleaned:

| Application ID | Total Docs | Estimated Duplicates |
|----------------|------------|---------------------|
| de514e29-a33a-... | 156 | 102 |
| 69c1cf8e-57d8-... | 153 | 99 |
| dd6b81b9-56f3-... | 77 | 33 |
| 7e70363f-dd5e-... | 27 | 18 |
| **c8223cbd-30e6-...** (your app) | 26 | 11 |
| + 3 more apps | - | - |

