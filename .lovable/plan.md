## Problem

Opening an application detail page (e.g. `/app/migration/applications/...`) renders a blank page when logged in.

## Root cause

Two `useQuery` hooks use the **same query key** `["application-applicants", visaApplicationId]` but return **different data shapes**:

- `src/pages/migration/ApplicationDetail.tsx` (~line 1176) — returns `{ id, applicant_type, displayName }` only (used to build the custom-document form).
- `src/components/visa-application/ApplicantsSection.tsx` (~line 128) — expects `created_at`, `sort_order`, `is_primary`, `documentCount`, etc.

React Query keeps one cache entry per key, so the two components can share the wrong shape. When `ApplicantsSection` receives the slim shape, `format(new Date(applicant.created_at), "dd MMM yyyy")` evaluates `new Date(undefined)` → Invalid Date → date-fns throws `RangeError: Invalid time value`, which crashes the entire React tree to a blank page. This only manifests when logged in (data actually loads), so the unauthenticated preview (which redirects to auth) masks it.

## Fix

Give the two queries distinct keys so they no longer collide.

1. In `ApplicationDetail.tsx`, change the form-helper query key from `["application-applicants", visaApplicationId]` to a distinct key such as `["application-applicants-form", visaApplicationId]`. This query feeds `applicantTypeToName` / the custom-document form only.
2. Leave `ApplicantsSection.tsx`'s query (the authoritative applicants list) on `["application-applicants", visaApplicationId]`, and keep the existing invalidations there.
3. Verify any `invalidateQueries` calls still target the correct keys after the rename (the add/remove mutations in `ApplicantsSection` invalidate `["application-applicants", visaApplicationId]`, which remains correct; if the custom-document flow needs to refresh its helper list, also invalidate the new `["application-applicants-form", ...]` key).

## Hardening (optional but recommended)

In `ApplicantsSection.tsx`, guard the date render so a bad/missing `created_at` can never blank the page again, e.g. only call `format` when `created_at` is a valid date, otherwise render a dash.

## Verification

- Reload the application detail page while authenticated; confirm it renders with the Applicants and Timeline sections.
- Confirm the custom-document form still shows correct applicant names.
- Add/remove an applicant and confirm both the list and the form helper refresh.
