

# Fix: Custom Documents Not Showing in Client Portal

## Problem Identified

After thorough investigation, the custom document **is being returned by the database** and should appear in the Client Portal. However, there are two issues causing confusion:

### Issue 1: Category Name Mismatch
The custom document categories use **short names** like "Identity", while standard documents use **full names** like "Identity Documents":

| Source | Category Used |
|--------|---------------|
| Custom document dropdown | `Identity`, `Health`, `Financial`, etc. |
| Standard templates | `Identity Documents`, `Health & Medical`, `Financial Documents`, etc. |

**Result**: Custom documents appear in a **separate category section** from standard documents. If a user adds a custom document under "Identity", it shows up under the "Identity" section, not the "Identity Documents" section where they might be looking.

### Issue 2: Missing `is_standard_for_client` Flag
When creating custom documents, the `is_standard_for_client` property is not set (defaults to `false`), while standard documents explicitly set it to `true`. This doesn't currently affect visibility but is inconsistent.

## Solution

### Part 1: Align Category Names (Recommended Fix)
Update the `defaultDocCategories` array in `ApplicationDetail.tsx` to match the actual category names used by standard templates:

**File**: `src/pages/migration/ApplicationDetail.tsx` (Line 906-910)

```typescript
// Current:
const defaultDocCategories = [
  "Identity", "Character", "Health", "Employment", "Skills",
  "English", "Education", "Financial", "Relationship",
  "Sponsor", "Insurance", "Nomination", "Other",
];

// Updated (match template categories):
const defaultDocCategories = [
  "Identity Documents", "Character Documents", "Health & Medical", 
  "Employment Records", "Skills Assessment", "English Proficiency", 
  "Educational Documents", "Financial Documents", "Relationship Evidence",
  "Sponsor Documents", "Insurance", "Nomination", "Supporting Evidence", 
  "Legal Documents", "Other",
];
```

### Part 2: Set `is_standard_for_client` for Custom Documents
Update the `addDocumentMutation` to include the flag for consistency:

**File**: `src/pages/migration/ApplicationDetail.tsx` (Lines 916-927)

```typescript
const { data, error } = await supabase
  .from("document_checklist")
  .insert({
    visa_application_id: visaApplicationId,
    company_id: visaApplication.company_id,
    document_name: `[Custom] ${doc.name}`,
    category: doc.category || "Other",
    applicant_type: doc.applicantType || null,
    is_completed: false,
    review_status: "pending_client",
    is_standard_for_client: true,  // ADD THIS LINE
    is_applicable: true,           // ALSO ADD THIS LINE (explicit)
  })
  .select()
  .single();
```

## Additional Consideration: Existing Custom Documents

For the existing custom document with `category: Identity`, you have two options:

1. **Manual fix**: Update the category in the database:
   ```sql
   UPDATE document_checklist 
   SET category = 'Identity Documents' 
   WHERE id = '7c63dcd9-ea9f-4b03-8d08-04db43229d75';
   ```

2. **Alternative approach**: Keep category as-is and the document will appear in its own "Identity" section within the "Primary Applicant" group

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/migration/ApplicationDetail.tsx` | Update `defaultDocCategories` array to match template category names |
| `src/pages/migration/ApplicationDetail.tsx` | Add `is_standard_for_client: true` and `is_applicable: true` to custom document insert |

## Expected Result

After these changes:
- New custom documents will appear grouped with related standard documents
- All documents will have consistent visibility flags
- Categories in the dropdown will match what users see in the document list

