
# Fix: Custom Documents Not Grouping Correctly + Remove [Custom] Tag

## Problems Identified

### Database Evidence
```
id: 23e600ac-adb4-4c5f-a530-ef074e6c3cba
document_name: [Custom] test
category: Education           ← Wrong! Should be "Educational Documents"
applicant_type: Primary Applicant
```

### Issue 1: Wrong Category Saved
The custom document was created before the category alignment fix. It was saved with `category: Education` instead of `category: Educational Documents`.

### Issue 2: `parseDocumentName` Overrides Category
In `ApplicationDetail.tsx`, the document mapping uses `parsed.category` (line 761), but the `parseDocumentName` function forcibly sets any document starting with `[Custom]` to have `category: "Custom"`:

```typescript
// Line 273-274
if (name.startsWith("[Custom] ")) {
  return { displayName: name.replace("[Custom] ", ""), category: "Custom", required: false };
}
```

This means **the database category is completely ignored** for custom documents in the admin view.

### Issue 3: User Wants No `[Custom]` Prefix
The document name includes `[Custom] test` but the user wants it to display as just `test`.

## Solution

### Part 1: Fix `parseDocumentName` to Use Database Category

Instead of hardcoding `category: "Custom"`, the function should return a marker that custom documents exist, but the actual grouping should use the **database category**.

**File**: `src/pages/migration/ApplicationDetail.tsx`

Update `parseDocumentName` to NOT override category:

```typescript
// Line 271-289
const parseDocumentName = (name: string): { displayName: string; category: string; required: boolean; isCustom: boolean } => {
  // Check if it's a custom document
  if (name.startsWith("[Custom] ")) {
    return { displayName: name.replace("[Custom] ", ""), category: "", required: false, isCustom: true };
  }
  
  // Check for category prefix pattern like "[Category:Required] Name"
  const match = name.match(/^\[([^:]+):?(required|optional)?\]\s*(.+)$/i);
  if (match) {
    return { 
      displayName: match[3], 
      category: match[1], 
      required: match[2]?.toLowerCase() === "required",
      isCustom: false
    };
  }
  
  // Default: treat as standard required document
  return { displayName: name, category: "General", required: true, isCustom: false };
};
```

### Part 2: Use Database Category for Custom Documents

Update document mapping to use `doc.category` from database when `parsed.category` is empty (custom documents):

```typescript
// Line 758-762
return {
  id: doc.id,
  name: parsed.displayName,
  category: parsed.category || doc.category || "Other",  // Fallback to DB category
  required: parsed.required,
  isCustom: parsed.isCustom,  // Add new property
  // ... rest
```

### Part 3: Remove [Custom] Prefix for New Documents

Change how custom documents are saved - use category tag format instead:

```typescript
// Line 921-924
const { data, error } = await supabase
  .from("document_checklist")
  .insert({
    visa_application_id: visaApplicationId,
    company_id: visaApplication.company_id,
    document_name: `[${doc.category || "Other"}:optional] ${doc.name}`,  // Use category tag format
    category: doc.category || "Other",
    // ... rest
```

This approach:
- Removes the `[Custom]` prefix entirely
- Uses the same format as standard templates
- Custom documents will parse correctly and group with related documents

### Part 4: Fix Existing Document in Database

Run this SQL to fix the existing "test" document:

```sql
UPDATE document_checklist 
SET 
  document_name = '[Educational Documents:optional] test',
  category = 'Educational Documents'
WHERE id = '23e600ac-adb4-4c5f-a530-ef074e6c3cba';
```

## Technical Summary

| File | Change |
|------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | Update `parseDocumentName` to not override category for custom docs |
| `src/pages/migration/ApplicationDetail.tsx` | Update document mapping to fallback to `doc.category` |
| `src/pages/migration/ApplicationDetail.tsx` | Change `addDocumentMutation` to use category tag format instead of `[Custom]` prefix |
| Database | Update existing document to use correct format |

## Expected Result

- Custom documents will appear grouped with standard documents in the same category
- No `[Custom]` tag will appear in document names
- Both admin view and client portal will show documents correctly
