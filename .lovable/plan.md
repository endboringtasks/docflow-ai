
## What’s happening (confirmed in Live DB)

For application **3975a8c4-a9bb-4f43-bc57-5ed969943179**, the `document_checklist` table shows the same documents inserted **twice**:

- First batch around **2026-01-27 04:51:32 UTC**
- Second batch around **2026-01-27 04:51:54 UTC**

Example duplicates (each has `cnt = 2`): Passport, Name Change Certificate, and even the “(Translation)” rows.

This means the checklist initialization is still being executed more than once for the same application, and the current prevention check is not reliably stopping the second run.

## Why it’s still duplicating (root cause)

Even after removing the redundant initialization from `ClientDetail.tsx` and `Applications.tsx`, duplicates can still occur because:

1. **The “duplicate prevention” check in `ApplicationDetail.tsx` is not reliable**
   - It uses:
     - `select("id", { count: "exact", head: true })`
   - In practice, this can return `count = null` (or be skipped if an error occurs), and the code currently does **not** check/throw on error.  
   - Result: the “if count > 0 then return” guard can silently fail and allow reinsertion.

2. **There is no database-level uniqueness constraint**
   - So even if the UI accidentally runs initialization twice (refresh, double navigation, multiple tabs, etc.), the database happily accepts duplicates.

The fix needs to be **idempotent** (safe to run multiple times) and backed by the database.

---

## Implementation plan (code + database hard-stop)

### 1) Strengthen the pre-check in `ApplicationDetail.tsx` (stop relying on `head: true` count)
**File:** `src/pages/migration/ApplicationDetail.tsx`

Replace the current count check:

- Current:
  - `.select("id", { count: "exact", head: true })`

With a simpler, reliable existence query:

- Use:
  - `.select("id").eq("visa_application_id", visaApplicationId).limit(1)`
- And **throw if error**.
- If `data.length > 0`, return early.

This makes it extremely unlikely the app will reinitialize if documents already exist.

### 2) Make inserts safe even if initialization runs twice (use upsert/ignore duplicates)
**File:** `src/pages/migration/ApplicationDetail.tsx`

Once we add the unique index (step 3), update both insert blocks:

- Original docs insertion
- Translation docs insertion

…to use either:
- `upsert(..., { onConflict: "...", ignoreDuplicates: true })`, or
- `insert()` and handle conflict errors gracefully (less ideal because it will throw user-facing errors).

Goal: if the init runs twice, the second run becomes a no-op.

### 3) Add a DB-level unique index to prevent duplicates forever
**File:** new migration under `supabase/migrations/`

Create a unique index on the natural “document identity”:

- `(visa_application_id, document_name, applicant_type, age_condition)`  
- Use `NULLS NOT DISTINCT` so NULL applicant_type / age_condition still conflicts (Postgres 17 supports this).

This ensures duplicates cannot be inserted even if the UI or multiple browsers race.

Important: this migration will fail if duplicates already exist, so cleanup must happen first (step 4).

### 4) Clean up existing duplicates (Live DB)
You currently have duplicates already (including for `3975a8c4-a9bb-4f43-bc57-5ed969943179`), so we need a cleanup before adding the unique index.

#### 4a) Targeted cleanup for the single application (safer first step)
Run this in **Supabase SQL Editor (Live)**.

**Preview what would be deleted:**
```sql
WITH attachment_counts AS (
  SELECT document_checklist_id, COUNT(*) AS attachment_count
  FROM public.document_attachments
  GROUP BY document_checklist_id
),
ranked AS (
  SELECT
    dc.id,
    dc.visa_application_id,
    dc.document_name,
    dc.applicant_type,
    dc.age_condition,
    dc.created_at,
    COALESCE(ac.attachment_count, 0) AS attachment_count,
    ROW_NUMBER() OVER (
      PARTITION BY dc.visa_application_id, dc.document_name, dc.applicant_type, dc.age_condition
      ORDER BY
        (COALESCE(ac.attachment_count, 0) > 0) DESC,
        (dc.file_path IS NOT NULL) DESC,
        dc.is_applicable DESC,
        dc.created_at ASC
    ) AS rn
  FROM public.document_checklist dc
  LEFT JOIN attachment_counts ac ON ac.document_checklist_id = dc.id
  WHERE dc.visa_application_id = '3975a8c4-a9bb-4f43-bc57-5ed969943179'
)
SELECT *
FROM ranked
WHERE rn > 1
ORDER BY document_name, created_at;
```

**Delete duplicates (keeps the “best” row per document):**
```sql
WITH attachment_counts AS (
  SELECT document_checklist_id, COUNT(*) AS attachment_count
  FROM public.document_attachments
  GROUP BY document_checklist_id
),
ranked AS (
  SELECT
    dc.id,
    ROW_NUMBER() OVER (
      PARTITION BY dc.visa_application_id, dc.document_name, dc.applicant_type, dc.age_condition
      ORDER BY
        (COALESCE(ac.attachment_count, 0) > 0) DESC,
        (dc.file_path IS NOT NULL) DESC,
        dc.is_applicable DESC,
        dc.created_at ASC
    ) AS rn
  FROM public.document_checklist dc
  LEFT JOIN attachment_counts ac ON ac.document_checklist_id = dc.id
  WHERE dc.visa_application_id = '3975a8c4-a9bb-4f43-bc57-5ed969943179'
)
DELETE FROM public.document_checklist
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
```

#### 4b) Global cleanup (needed before creating a global unique index)
After verifying the targeted cleanup works, we’ll run a similar dedupe query **without** the `WHERE visa_application_id = ...` filter, so the unique index can be created successfully.

### 5) Verification steps
After the code + DB fixes:

1. Create a brand-new application.
2. Open its Application Detail page.
3. Refresh the page a few times.
4. Confirm the checklist count stays stable (no doubling).
5. Confirm no new duplicates appear with:
   - `group by document_name, applicant_type, age_condition having count(*) > 1`.

---

## Deliverables (what will change)

### Code changes
- `src/pages/migration/ApplicationDetail.tsx`
  - Replace unreliable `head: true` count check with `select('id').limit(1)` + proper error handling.
  - Change inserts to `upsert(ignoreDuplicates)` once the unique index exists.

### Database changes
- New migration adding unique index:
  - Prevents duplicates permanently.

### Ops / maintenance
- One-time SQL cleanup to remove existing duplicates (starting with the specific application you shared, then global).

---

## Notes / expectations
- If your custom domain is pointing at a deployment that hasn’t been updated yet, the behavior won’t change until you deploy/publish the updated build. The DB-level unique index ensures that even if an older build runs the init twice, duplicates still cannot be created.