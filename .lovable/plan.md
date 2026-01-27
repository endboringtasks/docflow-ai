
<context>
User reports duplicates still appearing in Migration application detail pages. User asked to “check this application”:
- https://docflowai.endboringtasks.com/app/migration/applications/99b71a4d-45ba-4022-9939-8727eb8a9e02
They still see duplicated checklist documents.
We are in read-only planning mode and will propose the next implementation steps to permanently stop duplicates.
</context>

<what-i-checked-and-what-i-found>
1) Database confirms duplicates for visa_application_id = 99b71a4d-45ba-4022-9939-8727eb8a9e02
- Total rows: 26
- Pattern: 13 “template docs” inserted twice, in two batches about 8 seconds apart:
  - Batch A: 2026-01-27 05:26:56 UTC (11 originals) + 05:26:56.629 (2 translations)
  - Batch B: 2026-01-27 05:27:04 UTC (11 originals) + 05:27:04.553 (2 translations)
- Duplicates include the “(Translation)” items as well (they appear duplicated in UI because document_name matches, even if translation_of_id differs).

2) There is currently NO database-level uniqueness constraint preventing duplicates
- Only unique index is the primary key on id.
- This means any race condition or concurrent initialization will insert duplicates successfully.

3) Why duplicates can still happen even after the “exists” check change
- The current guard in ApplicationDetail.tsx is a read-then-write pattern:
  - “check if any docs exist” then “insert”
- If two initializations start before either one has inserted/committed rows (e.g., two users open the same application within seconds, or two tabs, or a quick remount), BOTH checks can see “0 rows” and BOTH will insert.
- This explains two batches separated by seconds: two runs started near the same time; one finished later.

4) Edge Functions are not inserting into document_checklist
- Edge functions only update existing checklist rows after uploads; they do not create checklist rows.
</what-i-checked-and-what-i-found>

<root-cause>
The checklist initialization is not atomic. Client-side checks cannot fully prevent duplicates under concurrency. A database-level unique constraint is required as the “hard stop”, and frontend inserts should become idempotent (upsert/ignore duplicates) to avoid user-facing errors.
</root-cause>

<goals>
- Permanently prevent duplicate checklist rows for the same application + document identity, even under concurrent initialization.
- Make initialization safe to run multiple times (no-op on second run).
- Clean up existing duplicates so the unique index can be created.
</goals>

<plan-overview>
We will implement 3 parts:
A) Database hard-stop (unique index)
B) Make initialization inserts idempotent (upsert/ignore duplicates + safer translation creation)
C) One-time cleanup of existing duplicates (required before adding the unique index)
</plan-overview>

<implementation-steps>
<step id="A1" title="Add database-level unique index (hard stop)">
Create a new migration that adds a unique index on the natural document identity:
- (visa_application_id, document_name, applicant_type, age_condition) with NULLS NOT DISTINCT

Why:
- This prevents duplicates forever, regardless of how many times initialization runs or how many users/tabs race.

Notes:
- Postgres 17 supports NULLS NOT DISTINCT (so NULL applicant_type/age_condition still collide correctly).
- This migration will fail until existing duplicates are removed (Step C).
</step>

<step id="B1" title="Change ApplicationDetail initialization to use upsert(ignoreDuplicates)">
File: src/pages/migration/ApplicationDetail.tsx

Replace the two sequential inserts:
- insert(documentsToInsert).select(...)
- insert(translationDocs)

With idempotent upserts:
1) Upsert originals with:
   - onConflict: "visa_application_id,document_name,applicant_type,age_condition"
   - ignoreDuplicates: true
2) Fetch the originals that require translation from the DB (not just from “returned insertedDocs”), so it works even if another client inserted some/all originals first.
3) Build translation docs from the fetched originals (needs original ids for translation_of_id), then upsert translations with the same onConflict + ignoreDuplicates.

Why this matters:
- With the unique index in place, even if two initializations race, the second becomes a harmless no-op (no duplicates, no errors).
- Fetching originals before building translations avoids missing translations when an upsert returns partial/empty data.

We will also update the fallback “default docs” insert to use upsert(ignoreDuplicates) for consistency.

Optional (nice-to-have):
- Keep the “exists” check to avoid unnecessary work, but it will no longer be relied upon for correctness.
</step>

<step id="B2" title="Make manual bulk-add safer (optional but recommended)">
File: src/pages/migration/ApplicationDetail.tsx

Update addMultipleDocumentsMutation (and possibly addDocumentMutation) to use upsert(ignoreDuplicates) as well, so even if two users bulk-add the same “standard docs” simultaneously it won’t error.
This is not the main source of duplicates, but it aligns with the new uniqueness rule and avoids rare conflict errors.
</step>

<step id="C1" title="One-time dedupe cleanup (required before creating the unique index)">
Because duplicates already exist globally (we detected many duplicate groups), the unique index cannot be created until the data is deduplicated.

We will provide 2 SQL scripts (user runs in Supabase SQL Editor on the production DB):
1) A “preview” query showing which rows would be removed.
2) A “dedupe + preserve data” script that:
   - Picks a single “keeper” row per duplicate group (prefers rows with attachments/file_path, then is_applicable, then earliest created)
   - Reassigns document_attachments from duplicate rows to the keeper row (so uploads are not lost)
   - Reassigns translation_of_id to point at the keeper original before deleting duplicate originals (prevents cascade deleting translations unintentionally)
   - Deletes the remaining duplicates

We will also provide a targeted per-application cleanup variant (like for 99b71a4d...) for quick validation before running global.
</step>

<step id="D1" title="Verification">
After C1 + A1 + B1 are completed:
1) Create a new application and open its Application Detail page.
2) Refresh the page multiple times.
3) Open the same application in 2 tabs quickly (or have two team members open it).
4) Confirm row counts stay stable.

DB verification query:
- Group by (visa_application_id, document_name, applicant_type, age_condition) and confirm no groups have count(*) > 1.
</step>
</implementation-steps>

<files-to-change>
- src/pages/migration/ApplicationDetail.tsx
- supabase/migrations/<new_migration>_unique_document_checklist_per_application.sql
</files-to-change>

<risks-and-mitigations>
- Risk: Adding a unique index will cause future duplicate insert attempts to conflict.
  Mitigation: Use upsert(ignoreDuplicates) so the app does not show errors; it simply no-ops.
- Risk: Cleanup could delete rows that have uploads.
  Mitigation: Cleanup script will explicitly preserve/move attachments and prefer rows with attachments/file_path.
- Risk: Cleanup could cascade-delete translations because translation_of_id has ON DELETE CASCADE.
  Mitigation: Cleanup script will first re-point translation_of_id to the keeper original, then delete duplicates.
</risks-and-mitigations>

<expected-outcome>
After these changes:
- Duplicates will stop permanently, including under races/concurrency.
- Existing duplicated applications (like 99b71a4d...) can be cleaned once, and will not re-duplicate again.
</expected-outcome>
