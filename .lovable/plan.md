# Application Applicants — Add / Remove with Audit

Builds on the **existing** `application_applicants` table and `ApplicantsSection` component rather than replacing them. Applicants continue to be selected from the primary client's `related_applicants` JSONB list (confirmed). We add: soft delete, per-applicant document linkage, enforced type/uniqueness rules, and a new general-purpose `application_timeline` audit log.

## 1. Functional Specification

- Each application has applicants of types from `applicant_types` reference data (reusing existing: Primary Applicant, Partner, Dependant, plus Sponsor/Witness which remain available).
- **Primary Applicant** is auto-created with the application and cannot be removed via this flow.
- Rules: max 1 Primary, max 1 Partner, multiple Dependants; same related person cannot be added twice; applicant type is mandatory and immutable after creation.
- Applicants are ordered Primary → Partner → Dependants; Dependants sorted by **created_at** (recommended over name — stable, reflects entry order, no churn when names edited).
- Removal is **soft delete** and is blocked if any document is attached to that applicant. Every add / remove / blocked-removal is written to the application timeline.

## 2. UX Specification

Within `ApplicantsSection` (rendered on `ApplicationDetail`):

- **List**: grouped by type with section labels (Primary Applicant / Partner / Dependants). Each row shows: name, applicant type badge, document count, created date, and a Remove (trash) button for Admin/Member (hidden on Primary).
- **Add Applicant dialog**: Applicant Type select (only types still allowed shown), Person select (from related_applicants of the chosen type, excluding already-added), Cancel + Add buttons. Inline validation messages exactly as specified.
- **Remove confirmation** (`AlertDialog`):
  - Default: "Are you sure you want to remove this applicant from the application?"
  - Blocked: "This applicant cannot be removed because documents are attached. Please remove or reassign the documents first." (Remove action disabled.)
- Toasts on success/failure via `sonner`.

## 3. Database Schema

### 3.1 `application_applicants` (alter existing)
Add columns: `created_by uuid`, `deleted_at timestamptz`, `deleted_by uuid`. Keep existing `related_applicant_id`, `is_primary`, `applicant_type_id`, `client_id`, `sort_order`, `created_at`.

Partial unique indexes (only over non-deleted rows, `deleted_at IS NULL`):
- One Primary per application: unique `(visa_application_id)` where `is_primary = true`.
- One Partner per application: unique `(visa_application_id, applicant_type_id)` where type = Partner.
- No duplicate person: unique `(visa_application_id, related_applicant_id)` where `related_applicant_id IS NOT NULL`.

### 3.2 `document_checklist` (alter existing)
Add `application_applicant_id uuid` (nullable; links a document to a specific applicant). Used for the removal-block check and document counts.

### 3.3 `application_timeline` (new, general-purpose)
Columns: `id`, `visa_application_id`, `company_id`, `event_type text` (e.g. `applicant_added`, `applicant_removed`, `applicant_remove_blocked`), `entity_type text`, `entity_id uuid`, `actor_id uuid`, `description text`, `old_values jsonb`, `new_values jsonb`, `created_at`. Full GRANTs + RLS: company members can SELECT; company members can INSERT for their company; no UPDATE/DELETE.

## 4. API / Supabase Query Design

All from the client via the existing `supabase` SDK (RLS-enforced), following current `ApplicantsSection` patterns:
- **List applicants**: select non-deleted `application_applicants` for the application + join `applicant_types`; resolve display names from `related_applicants` JSONB.
- **Document counts per applicant**: count `document_checklist` rows grouped by `application_applicant_id`.
- **Add**: insert applicant row (with `created_by = auth.uid()`), then insert `application_timeline` `applicant_added` row.
- **Remove**: check document count for that applicant; if > 0 insert `applicant_remove_blocked` timeline row and abort; else set `deleted_at`/`deleted_by` and insert `applicant_removed` timeline row.

DB-level enforcement of uniqueness (Section 3.1) backs up client validation.

## 5. Business Rules

Primary auto-assigned & non-removable; 1 Primary, 1 Partner, many Dependants; type mandatory & immutable; no duplicate person; soft delete; removal blocked when documents attached.

## 6. Validation Rules (messages)
- "Please select a client." / "Please select an applicant type."
- "This client is already added to this application."
- "This application already has a Primary Applicant." / "This application already has a Partner."
- Blocked removal message (Section 2).

## 7. Permission Rules
- Add/remove allowed for company Admin and Member (`is_company_member`); RLS already restricts to company members, and the existing manage policy covers owners/admins — we will widen the manage policy to members for applicant rows, matching the "Member" requirement. Read-only/external/portal users cannot add or remove.

## 8. Application Timeline / Audit Logic
Each add, remove, and blocked-removal writes a row capturing actor (`auth.uid()`), timestamp, and old/new values (applicant name + type). Timeline is displayed read-only; surfaced in a Timeline section on the application page.

## 9. Edge Cases
- Removing Primary blocked (no remove button + guard).
- Concurrent adds of second Primary/Partner caught by partial unique index → friendly toast.
- Re-adding a previously soft-deleted person allowed (partial index ignores deleted rows).
- Documents with null `application_applicant_id` are not counted against any applicant.
- Related person deleted from JSONB while still an applicant → display falls back to applicant type name (existing behavior).

## 10. Test Plan
- Add each type; verify ordering and that exhausted types disappear from the dropdown.
- Attempt duplicate person / second Primary / second Partner → blocked with correct message.
- Remove with no documents → soft-deleted, disappears, timeline `applicant_removed`.
- Remove with documents → blocked message, stays, timeline `applicant_remove_blocked`.
- Verify timeline actor/timestamp/old-new values.
- Verify Member can add/remove; portal/read-only cannot.

## 11. Implementation Steps
1. Migration: alter `application_applicants` (created_by, deleted_at, deleted_by) + partial unique indexes; alter `document_checklist` (application_applicant_id); create `application_timeline` (GRANTs, RLS); widen applicant manage policy to members.
2. Filter all existing applicant queries to `deleted_at IS NULL`.
3. Update `ApplicantsSection`: grouped/ordered list, document counts, created date, validation, add mutation + timeline write.
4. Add Remove flow: confirmation dialog, document-count guard, soft-delete mutation + timeline writes.
5. Add a read-only **Timeline** section on `ApplicationDetail` reading `application_timeline`.
6. Ensure Primary auto-creation on application create sets `is_primary` + `created_by` (verify existing create path).
7. QA against the Test Plan.

### Technical notes
- No hard deletes of applicant rows; document files untouched (consistent with CDR rules which govern file deletion, not applicant unlink).
- Display-name resolution reuses the existing `related_applicants` JSONB logic in `ApplicantsSection`.
- All new colors/styles use existing semantic tokens; dialogs reuse existing shadcn components.
