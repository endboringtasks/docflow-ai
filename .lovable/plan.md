# Implementation Plan Archive

## Completed: Add Dynamic Applicant Types to Application Creation and Management

**Status:** ✅ Implemented

### What was built:

1. **ApplicantSelector Component** (`src/components/visa-application/ApplicantSelector.tsx`)
   - Displays applicant type options based on category rules
   - Shows primary applicant as read-only
   - Supports Yes/No toggles for optional single types (Partner, Witness)
   - Supports count input for multiple types (Dependant)
   - Client dropdown selection for each applicant

2. **ApplicantsSection Component** (`src/components/visa-application/ApplicantsSection.tsx`)
   - Displays existing applicants on the Application Detail page
   - Add button to create new applicants
   - Remove button for non-primary applicants
   - Respects category rules for max counts

3. **Applications.tsx Updates**
   - Added ApplicantSelector to the Create Application dialog
   - Applicants section appears after category is selected
   - Creates `application_applicants` records on application creation
   - Resets applicant selections when category changes

4. **ApplicationDetail.tsx Updates**
   - Added ApplicantsSection below the header card
   - Shows all linked applicants with their types
   - Allows adding/removing applicants post-creation

### Database tables used:
- `category_applicant_types` - Rules per category
- `application_applicants` - Applicants per application
- `applicant_types` - Reference data (Primary, Partner, Dependant, etc.)
