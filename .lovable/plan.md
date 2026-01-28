

# Group Translations with Parent Documents and Clean Up Display

## Problem

Currently in the client portal, translation documents are displayed:
1. With the "(Translation)" suffix in their names (e.g., "Divorce Certificate (Translation)")
2. Scattered in the document list rather than grouped with their parent original document

The user wants:
- Remove "(Translation)" suffix from document names
- Show translations immediately after their parent document for a cleaner, grouped view

## Solution

Modify both the client portal and application detail page to:
1. Sort documents so translations appear right after their parent (using `translation_of_id`)
2. Strip the "(Translation)" suffix from document names
3. Keep the existing translation badge to identify translations (it already shows "Translation • NAATI Certified")

## Files to Change

| File | Change |
|------|--------|
| `src/pages/client-portal/ClientPortal.tsx` | Add sorting logic + strip "(Translation)" from names |
| `src/pages/migration/ApplicationDetail.tsx` | Add sorting logic + strip "(Translation)" from names |

## Implementation

### 1. Client Portal - Group translations with parents

In the `groupedByApplicantType` useMemo (lines 658-673), modify to sort documents within each category so translations follow their parent:

```typescript
const groupedByApplicantType = useMemo(() => {
  const groups: Record<string, Record<string, DocumentItem[]>> = {};
  documents.forEach(doc => {
    const applicantType = doc.applicant_type || "General";
    const category = doc.category || "Other Documents";
    
    if (!groups[applicantType]) {
      groups[applicantType] = {};
    }
    if (!groups[applicantType][category]) {
      groups[applicantType][category] = [];
    }
    groups[applicantType][category].push(doc);
  });
  
  // Sort each category so translations follow their parent document
  Object.keys(groups).forEach(applicantType => {
    Object.keys(groups[applicantType]).forEach(category => {
      const docs = groups[applicantType][category];
      // Separate originals and translations
      const originals = docs.filter(d => !d.translation_of_id);
      const translations = docs.filter(d => d.translation_of_id);
      
      // Rebuild array: original followed by its translation(s)
      const sorted: DocumentItem[] = [];
      originals.forEach(original => {
        sorted.push(original);
        // Find and add any translations for this original
        translations
          .filter(t => t.translation_of_id === original.id)
          .forEach(t => sorted.push(t));
      });
      // Add any orphan translations at the end
      translations
        .filter(t => !originals.some(o => o.id === t.translation_of_id))
        .forEach(t => sorted.push(t));
      
      groups[applicantType][category] = sorted;
    });
  });
  
  return groups;
}, [documents]);
```

### 2. Client Portal - Strip "(Translation)" from document names

Update the document name display (line 1003) to also remove "(Translation)":

```typescript
{doc.document_name
  .replace(/\s*\[[^\]]*:(?:required|optional)\]\s*/gi, " ")
  .replace(/\s*\(Translation\)\s*/gi, "")
  .trim()}
```

### 3. Application Detail - Same grouping logic

Apply the same sorting logic to `groupedByApplicantType` in ApplicationDetail.tsx (lines 1486-1503).

### 4. Application Detail - Strip "(Translation)" from names

Update the document name display (around line 1963) to remove "(Translation)":

```typescript
{doc.name.replace(/\s*\(Translation\)\s*/gi, "").trim()}
```

## Visual Result

**Before:**
```
○ National ID Card               ⏳ Pending Client
○ Passport                       ⏳ Pending Client
○ Name Change Certificate        ⏳ Pending Client
○ Divorce Certificate           ↔ Has Translation  ⏳ Pending Client
○ Driver's License               ⏳ Pending Client
○ Birth Certificate              ⏳ Pending Client
○ Divorce Certificate (Translation)  文 Translation • NAATI Certified  ⏳ Pending Client
```

**After:**
```
○ National ID Card               ⏳ Pending Client
○ Passport                       ⏳ Pending Client
○ Name Change Certificate        ⏳ Pending Client
○ Divorce Certificate           ↔ Has Translation  ⏳ Pending Client
○ Divorce Certificate            文 Translation • NAATI Certified  ⏳ Pending Client
○ Driver's License               ⏳ Pending Client
○ Birth Certificate              ⏳ Pending Client
```

The translation badge clearly identifies it as a translation, so the "(Translation)" suffix becomes redundant and can be removed.

