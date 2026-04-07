

## Filter Document Checklist by Actual Application Applicants

### Problem
When documents are initialized for an application (in `ApplicationDetail.tsx`), ALL templates linked to the visa type are inserted — including those with `applicant_type = "Partner"` or "Dependant" — regardless of whether such applicant types were actually added to the application via `application_applicants`. This causes partner/dependant documents to appear automatically whenever a partner exists on the client profile.

### Root Cause
The document initialization logic (around line 792) maps templates to checklist items without checking `application_applicants`. It blindly includes all templates, so if any template has `applicant_type = "Partner"`, partner documents appear even if no partner was added to this specific application.

### Fix

**File: `src/pages/migration/ApplicationDetail.tsx` (~lines 792-830)**

1. **Before inserting documents**, query `application_applicants` for this application to get the list of active applicant type names (e.g., "Primary", "Partner", "Dependant").

2. **Filter templates**: Only include templates where:
   - `applicant_type` is null (applies to everyone), OR
   - `applicant_type.name` matches one of the active applicant types in the application

3. Apply the same filtering to the **second initialization path** (the fallback around line 1238 if applicable).

### Technical Detail

```typescript
// Before document insertion, fetch active applicant types for this application
const { data: activeApplicants } = await supabase
  .from("application_applicants")
  .select("applicant_type:applicant_types(name)")
  .eq("visa_application_id", visaApplicationId);

const activeApplicantTypeNames = new Set(
  (activeApplicants || [])
    .map(a => a.applicant_type?.name)
    .filter(Boolean)
);

// Then filter templates before insertion:
const filteredTemplates = templates.filter((template: any) => {
  const typeName = template.applicant_type?.name;
  // Include if no applicant type specified, or if the type is active on this application
  return !typeName || activeApplicantTypeNames.has(typeName);
});
```

This ensures that partner/dependant documents only appear when those applicant types have been explicitly added to the application — not just because they exist on the client profile.

