
## Fix: Duplicate Applicant Rules Showing in Selector

### Root Cause Analysis

The issue is in the rule filtering logic in `ApplicantSelector.tsx`. Currently:

1. The query fetches **all** rules for the category (not filtered by subcategory)
2. The current filter logic has a flaw:
   ```javascript
   const specificRules = rules.filter(r => r.subcategory_id === subcategoryId);
   const fallbackRules = rules.filter(r => r.subcategory_id === null);
   return specificRules.length > 0 ? specificRules : fallbackRules;
   ```

**Problem**: This returns EITHER specific rules OR fallback rules, but what we need is:
- For each applicant type, prefer the specific subcategory rule if it exists
- If no specific rule exists for that type, use the fallback (null subcategory) rule

Looking at the database:
- Partner rules exist for each specific subcategory (Visitor, Family, Working, etc.)
- Primary Applicant only exists as a fallback (subcategory_id = null)

With the current logic, when "Visitor" is selected, `specificRules` only contains Partner + Dependant for Visitor, and Primary Applicant (which has null subcategory) is excluded entirely.

Additionally, there may be a scenario where the rules aren't being filtered properly, causing all 5 Partner rules (one per subcategory) to display.

---

### The Solution

Update the filtering logic to properly merge specific and fallback rules per applicant type:

```javascript
// Group rules by applicant_type_id
const rulesByType = new Map<string, typeof rules[0]>();

// First, add fallback rules (subcategory_id = null)
rules
  .filter(r => r.subcategory_id === null)
  .forEach(r => rulesByType.set(r.applicant_type_id, r));

// Then, override with specific subcategory rules if they exist
rules
  .filter(r => r.subcategory_id === subcategoryId)
  .forEach(r => rulesByType.set(r.applicant_type_id, r));

// Convert back to array and sort
return Array.from(rulesByType.values())
  .sort((a, b) => a.sort_order - b.sort_order);
```

This ensures:
- Primary Applicant (fallback) is included
- Partner with Visitor-specific settings is included (not 5 copies)
- Dependant with Visitor-specific settings is included

---

### Files to Modify

| File | Change |
|------|--------|
| `src/components/visa-application/ApplicantSelector.tsx` | Fix rule filtering logic to merge by applicant_type_id |
| `src/components/visa-application/ApplicantsSection.tsx` | Apply same fix for consistency |

---

### Technical Details

#### ApplicantSelector.tsx Changes (lines 100-114)

**Before:**
```javascript
// Filter: prefer specific subcategory rules, fall back to null (category-wide)
const rules = data as (CategoryApplicantRule & { subcategory_id: string | null })[];
const specificRules = rules.filter(r => r.subcategory_id === subcategoryId);
const fallbackRules = rules.filter(r => r.subcategory_id === null);

// If there are specific rules for this subcategory, use those; otherwise use fallback
return specificRules.length > 0 ? specificRules : fallbackRules;
```

**After:**
```javascript
const rules = data as (CategoryApplicantRule & { subcategory_id: string | null })[];

// Merge rules: fallback first, then override with specific subcategory rules
const rulesByType = new Map<string, (typeof rules)[0]>();

// Add fallback rules (subcategory_id = null)
rules
  .filter(r => r.subcategory_id === null)
  .forEach(r => rulesByType.set(r.applicant_type_id, r));

// Override with specific subcategory rules
rules
  .filter(r => r.subcategory_id === subcategoryId)
  .forEach(r => rulesByType.set(r.applicant_type_id, r));

// Return merged rules sorted by sort_order
return Array.from(rulesByType.values())
  .sort((a, b) => a.sort_order - b.sort_order);
```

---

### Expected Result

After this fix, when creating an application with:
- Category: Visa
- Subcategory: Visitor

The Applicants section will show:
- **Primary Applicant** (from fallback rule) - Required
- **Partner** (from Visitor-specific rule) - Optional toggle
- **Dependant** (from Visitor-specific rule) - Multiple with count input

No more duplicate Partner entries.
