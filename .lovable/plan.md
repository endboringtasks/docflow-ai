
# Fix: Translation Documents Should Inherit `is_applicable` from Original at Creation

## Problem Summary

For **newly created applications**, translation documents are still appearing in the Client Portal even when their parent original document is already marked as N/A.

**Database evidence for application `2f27e9e6-4fda-49bd-a6c4-77dc7cf4a61e`:**

| Document | is_applicable | Parent is_applicable |
|----------|---------------|---------------------|
| Divorce Certificate | false | - |
| Divorce Certificate (Translation) | **true** (wrong!) | false |
| Military Service or Discharge Records | false | - |
| Military Service or Discharge Records (Translation) | **true** (wrong!) | false |

## Root Cause

The previous fix (cascading `is_applicable` on toggle) only works when someone **manually toggles** a document. But in this case:

1. The original documents are created with `is_applicable = false` from the template (because `requirement_type === "conditional"`)
2. Translation documents are created in a separate pass that does **not inherit** `is_applicable` from the original
3. No explicit `is_applicable` is set, so it defaults to `true`

**Current code (lines 642-661):**
```typescript
const translationDocs = (originalsNeedingTranslation || []).map((originalDoc: any) => {
  return {
    visa_application_id: visaApplicationId,
    // ... other fields ...
    // is_applicable is MISSING - defaults to true!
  };
});
```

## Solution

When creating translation documents during initialization, **explicitly set `is_applicable` to match the original document's value**.

### Changes Required

**File:** `src/pages/migration/ApplicationDetail.tsx`

1. Modify the query that fetches originals needing translation to also include `is_applicable` (line 632-637)
2. When building translation docs, set `is_applicable: originalDoc.is_applicable` (line 644-660)

### Code Change

**Step 1: Update the fetch query to include `is_applicable`**

```typescript
// Re-fetch originals that require translation from DB
const { data: originalsNeedingTranslation, error: fetchOriginalsError } = await supabase
  .from("document_checklist")
  .select("id, document_name, category, description, applicant_type, age_condition, requires_translation, translation_target_language, translation_certification_type_id, translation_notes, is_applicable")  // ADD is_applicable
  .eq("visa_application_id", visaApplicationId)
  .eq("requires_translation", true)
  .is("translation_of_id", null);
```

**Step 2: Set `is_applicable` when creating translation docs**

```typescript
const translationDocs = (originalsNeedingTranslation || []).map((originalDoc: any) => {
  const translationName = `[${originalDoc.category || "General"}:required] ${originalDoc.document_name.replace(/^\[[^\]]+\]\s*/, "")} (Translation)`;
  return {
    visa_application_id: visaApplicationId,
    company_id: visaApplication.company_id,
    document_name: translationName,
    category: originalDoc.category,
    description: `Certified translation of: ${originalDoc.document_name.replace(/^\[[^\]]+\]\s*/, "")}`,
    applicant_type: originalDoc.applicant_type,
    age_condition: originalDoc.age_condition,
    is_completed: false,
    is_standard_for_client: true,
    review_status: "pending_client",
    requires_translation: false,
    translation_of_id: originalDoc.id,
    translation_target_language: originalDoc.translation_target_language,
    translation_certification_type_id: originalDoc.translation_certification_type_id,
    translation_notes: originalDoc.translation_notes,
    is_applicable: originalDoc.is_applicable,  // INHERIT from original
  };
});
```

## Data Cleanup (Existing Records)

After fixing the code, run this SQL in **Supabase SQL Editor** to fix existing translation documents that should be N/A:

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

## Files to Change

| File | Change |
|------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | Add `is_applicable` to translation doc creation, inheriting from original |

## Summary of All Translation Applicability Fixes

With this change, we now have **complete coverage**:

| Scenario | Fix |
|----------|-----|
| User toggles original to N/A | `toggleApplicabilityMutation` cascades to translations (already implemented) |
| Original created as N/A from template | Translation inherits `is_applicable` at creation time (this fix) |

## Verification

After implementing:
1. Create a new visa application with a subclass that has conditional documents (like Divorce Certificate)
2. Open the Client Portal link
3. Verify that translations for N/A documents do NOT appear
4. Toggle an N/A document to "Applies" in the admin view
5. Verify the translation now appears in the Client Portal
