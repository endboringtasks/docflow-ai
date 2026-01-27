

## Fix Unique Constraint for Category Applicant Types

### The Problem
The existing unique constraint on `category_applicant_types` only includes two columns:
```sql
UNIQUE (category_id, applicant_type_id)
```

This prevents adding the same applicant type (e.g., "Primary Applicant") to different subcategories within the same category, which is exactly what we need to do.

### The Solution
Update the unique constraint to include `subcategory_id`:
```sql
UNIQUE (category_id, subcategory_id, applicant_type_id)
```

This allows:
- "Primary Applicant" for Visa → Family and Partner
- "Primary Applicant" for Visa → Working and Skilled  
- "Primary Applicant" for Visa → NULL (all subcategories default)

---

### Database Migration

```sql
-- Drop the existing constraint
ALTER TABLE category_applicant_types 
DROP CONSTRAINT category_applicant_types_category_id_applicant_type_id_key;

-- Add new constraint including subcategory_id
ALTER TABLE category_applicant_types 
ADD CONSTRAINT category_applicant_types_category_subcategory_applicant_key 
UNIQUE (category_id, subcategory_id, applicant_type_id);
```

---

### Files to Modify

| File | Changes |
|------|---------|
| New migration file | Drop old constraint, add new one with 3 columns |

This is a quick schema fix - no code changes needed.

