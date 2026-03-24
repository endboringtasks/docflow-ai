

## Use Collapsible "Previous Versions" in Applicant View

The applicant view in `ApplicationDetail.tsx` currently passes `inline={true}` to `DocumentHistorySection`, which renders history entries flat without the collapsible wrapper. The client portal omits this prop, getting the collapsible "Previous Versions" UI with the badge count.

### Change

**File: `src/pages/migration/ApplicationDetail.tsx`**

Remove `inline={true}` from both `DocumentHistorySection` usages (lines 2493 and 2517) so the applicant view uses the same collapsible "Previous Versions" section as the client portal.

