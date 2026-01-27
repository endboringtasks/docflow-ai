

## Add Subcategory Support to Category Applicant Rules

### The Problem
Currently, applicant rules are configured per **category only**. However, different subcategories within the same category often have different applicant requirements:

| Category | Subcategory | Required Applicants |
|----------|-------------|---------------------|
| Visa | Family and Partner | Primary + **Partner** + Dependants |
| Visa | Working and Skilled | Primary only |
| Visa | Refugee and Humanitarian | Primary + Dependants |

The admin UI only shows a single category dropdown, but you need to configure rules at the **category + subcategory level**.

---

### The Solution

#### 1. Database Schema Change
Add an optional `subcategory_id` column to the `category_applicant_types` table:

```sql
ALTER TABLE category_applicant_types 
ADD COLUMN subcategory_id uuid REFERENCES application_subcategories(id) ON DELETE CASCADE;
```

**Matching Logic:**
- If a rule has `subcategory_id = NULL`, it applies to **all subcategories** in that category (default/fallback)
- If a rule has `subcategory_id = 'xyz'`, it applies **only** to that specific subcategory

---

#### 2. Admin UI Changes (CategoryApplicantRulesTab.tsx)

**Updated Selector Flow:**
```text
┌─────────────────────────────────────────────────────────────────┐
│  Category: [Visa                    ▼]                         │
│  Subcategory: [Family and Partner   ▼] or [All Subcategories]  │
│                                                                 │
│  [+ Add Applicant Type]                                         │
└─────────────────────────────────────────────────────────────────┘
```

| Change | Description |
|--------|-------------|
| Add state | `selectedSubcategoryId` (nullable - null means "all subcategories") |
| Add query | Fetch subcategories filtered by selected category |
| Add second dropdown | Show subcategories + "All Subcategories (default)" option |
| Update queries | Filter rules by both `category_id` AND `subcategory_id` |
| Update mutations | Include `subcategory_id` when saving rules |
| Update interface | Add `subcategory_id` to `CategoryApplicantType` interface |

---

#### 3. Consumer Component Changes

**ApplicantSelector.tsx** - Used in application creation:
| Change | Description |
|--------|-------------|
| Add prop | `subcategoryId?: string` |
| Update query | Fetch rules matching either exact subcategory OR null subcategory (fallback) |
| Update query key | Include subcategoryId for cache separation |

**ApplicantsSection.tsx** - Used in application detail:
| Change | Description |
|--------|-------------|
| Add prop | `subcategoryId: string \| null` |
| Update query | Same logic - match specific OR fallback to null |

**Applications.tsx** - Pass subcategoryId:
```tsx
<ApplicantSelector
  categoryId={newApplication.categoryId}
  subcategoryId={newApplication.subcategoryId}  // NEW
  primaryClientId={newApplication.clientId}
  selections={applicantSelections}
  onSelectionsChange={setApplicantSelections}
/>
```

**ApplicationDetail.tsx** - Pass subcategoryId:
```tsx
<ApplicantsSection
  visaApplicationId={visaApplication.id}
  categoryId={visaApplication.category_id}
  subcategoryId={visaApplication.subcategory_id}  // NEW
  companyId={currentCompany.id}
/>
```

---

### Rule Matching Logic

When fetching rules for an application:

```sql
-- Get rules for this category where:
-- 1. subcategory_id matches exactly, OR
-- 2. subcategory_id is NULL (category-wide default)
SELECT * FROM category_applicant_types
WHERE category_id = $categoryId
  AND (subcategory_id = $subcategoryId OR subcategory_id IS NULL)
ORDER BY 
  subcategory_id NULLS LAST,  -- Prefer specific over default
  sort_order;
```

**Priority Logic:**
- If specific subcategory rules exist → use those only
- If no specific rules → fall back to category-wide defaults (where `subcategory_id IS NULL`)

---

### Files to Modify

| File | Changes |
|------|---------|
| Database migration | Add `subcategory_id` column to `category_applicant_types` |
| `src/components/admin/CategoryApplicantRulesTab.tsx` | Add subcategory selector, update queries/mutations |
| `src/components/visa-application/ApplicantSelector.tsx` | Add `subcategoryId` prop, update query logic |
| `src/components/visa-application/ApplicantsSection.tsx` | Add `subcategoryId` prop, update query logic |
| `src/pages/migration/Applications.tsx` | Pass `subcategoryId` to ApplicantSelector |
| `src/pages/migration/ApplicationDetail.tsx` | Pass `subcategoryId` to ApplicantsSection |
| `src/integrations/supabase/types.ts` | Will auto-update after migration |

---

### Updated Admin UI Wireframe

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Configure which applicant types are required for each category/subcategory │
│                                                                             │
│ Category: [Visa                    ▼]                                       │
│ Subcategory: [Family and Partner   ▼]    [+ Add Applicant Type]             │
│              ☐ All Subcategories (default rules)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Order │ Applicant Type          │ Required │ Multiple │ Min │ Max │ Actions │
├───────┼─────────────────────────┼──────────┼──────────┼─────┼─────┼─────────┤
│   0   │ Primary Applicant       │   ●───   │   ───○   │  1  │  1  │   🗑    │
│  10   │ Partner                 │   ●───   │   ───○   │  1  │  1  │   🗑    │
│  20   │ Dependant               │   ───○   │   ●───   │  0  │ 10  │   🗑    │
└─────────────────────────────────────────────────────────────────────────────┘
```

