

# Fix: Translation Documents Should Follow Parent's Applicability

## Problem Summary

When a user toggles a document (e.g., "Divorce Certificate") to **N/A** (not applicable), the linked translation document (e.g., "Divorce Certificate (Translation)") is **not updated** and remains `is_applicable = true`.

This causes the translation document to still appear in the **Client Portal** - even though the original document it translates is marked as N/A.

**Current behavior in database:**

| Document | is_applicable |
|----------|---------------|
| Divorce Certificate | **false** (N/A) |
| Divorce Certificate (Translation) | **true** (showing in portal) |
| Military Service or Discharge Records | **false** (N/A) |
| Military Service or Discharge Records (Translation) | **true** (showing in portal) |

---

## Root Cause

The `toggleApplicabilityMutation` (lines 801-817 in `ApplicationDetail.tsx`) only updates the single document that was toggled:

```typescript
const { error } = await supabase
  .from("document_checklist")
  .update({ is_applicable: isApplicable })
  .eq("id", docId);  // Only updates ONE document
```

It does not propagate the change to any translation documents that reference this original via `translation_of_id`.

---

## Solution

When toggling a document's applicability, **also update any translation documents** that have `translation_of_id` pointing to this document.

### Changes Required

**File:** `src/pages/migration/ApplicationDetail.tsx`

Update `toggleApplicabilityMutation` to:
1. Update the target document's `is_applicable` as before
2. Also update any documents where `translation_of_id = docId` to match the same `is_applicable` value

```typescript
mutationFn: async ({ docId, isApplicable }: { docId: string; isApplicable: boolean }) => {
  // Update the original document
  const { error: originalError } = await supabase
    .from("document_checklist")
    .update({ is_applicable: isApplicable })
    .eq("id", docId);
  
  if (originalError) throw originalError;
  
  // Also update any translation documents that reference this original
  const { error: translationError } = await supabase
    .from("document_checklist")
    .update({ is_applicable: isApplicable })
    .eq("translation_of_id", docId);
  
  if (translationError) throw translationError;
},
```

---

## Data Cleanup (Existing Records)

After fixing the code, you need to clean up existing data where translation documents have `is_applicable = true` but their parent original has `is_applicable = false`.

**Run this in Supabase SQL Editor (Production):**

```sql
-- Preview: Show translation docs that should be N/A
SELECT 
  trans.id,
  trans.document_name AS translation_name,
  trans.is_applicable AS trans_is_applicable,
  orig.document_name AS original_name,
  orig.is_applicable AS original_is_applicable
FROM public.document_checklist trans
INNER JOIN public.document_checklist orig ON trans.translation_of_id = orig.id
WHERE trans.is_applicable = true
  AND orig.is_applicable = false;

-- Fix: Set translation docs to N/A when their original is N/A
UPDATE public.document_checklist trans
SET is_applicable = false
FROM public.document_checklist orig
WHERE trans.translation_of_id = orig.id
  AND trans.is_applicable = true
  AND orig.is_applicable = false;
```

---

## Technical Details

### Why This Happens

1. **Document creation:** Translation documents are created with `is_applicable` defaulting to `true` (not inherited from the original at creation time)
2. **Toggle mutation:** Only updates the clicked document, not its linked translations
3. **Portal filter:** `get_portal_documents` correctly filters by `is_applicable = true`, but sees the translation as applicable even though its parent isn't

### Alternative Considered

We could update `get_portal_documents` to check the parent's applicability:

```sql
WHERE dc.is_applicable = true
  AND (dc.translation_of_id IS NULL 
       OR EXISTS (SELECT 1 FROM document_checklist parent 
                  WHERE parent.id = dc.translation_of_id 
                  AND parent.is_applicable = true))
```

However, the proposed solution (updating translation docs when toggling) is simpler and keeps the data consistent, making it easier to understand the checklist state at a glance.

---

## Files to Change

| File | Change |
|------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | Update `toggleApplicabilityMutation` to cascade to translation documents |

---

## Verification

After implementing:
1. Go to the application detail page
2. Toggle "Divorce Certificate" to N/A
3. Verify "Divorce Certificate (Translation)" automatically becomes N/A
4. Toggle "Divorce Certificate" back to Applies
5. Verify "Divorce Certificate (Translation)" automatically becomes applicable again
6. Check the Client Portal - N/A documents and their translations should no longer appear

