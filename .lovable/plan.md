

## Skip Drive folder status when Google Drive is not connected

### Problem
When Google Drive is not connected, newly created clients still get `folder_status = 'pending'` (the database default), which shows a misleading "Pending" badge in the Drive Folder column. The user expects no folder-related status when Drive isn't even set up.

### Solution

**1. Database: Allow `null` folder_status**
- Alter the `folder_status` column on `clients` (and `matters`) to allow NULL and change the default to NULL
- Update the CHECK constraint to also allow NULL
- When Drive is not connected, clients will have `folder_status = NULL` (meaning "not applicable")

**2. Create mutation: Set folder_status explicitly**
- When Drive IS connected (`rootFolderId` exists): set `folder_status = 'pending'` on insert (or leave default behavior after migration sets default to NULL, then update to 'pending' before dispatching webhook)
- When Drive is NOT connected: leave `folder_status` as NULL (no update needed)

**3. UI: Handle null folder_status**
- When `folder_status` is null, show a dash or "N/A" instead of "Pending"
- Only show "Pending" when folder_status is explicitly `'pending'` (Drive connected, folder not yet created)

### Technical Details

**New SQL migration:**
```sql
ALTER TABLE public.clients 
  ALTER COLUMN folder_status DROP NOT NULL,
  ALTER COLUMN folder_status SET DEFAULT NULL,
  DROP CONSTRAINT IF EXISTS clients_folder_status_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_folder_status_check 
  CHECK (folder_status IS NULL OR folder_status IN ('pending', 'creating', 'created', 'failed'));

-- Same for matters table
ALTER TABLE public.matters 
  ALTER COLUMN folder_status DROP NOT NULL,
  ALTER COLUMN folder_status SET DEFAULT NULL,
  DROP CONSTRAINT IF EXISTS matters_folder_status_check;

ALTER TABLE public.matters
  ADD CONSTRAINT matters_folder_status_check 
  CHECK (folder_status IS NULL OR folder_status IN ('pending', 'creating', 'created', 'failed'));

-- Set existing clients without folders to NULL if they have 'pending' status
UPDATE public.clients SET folder_status = NULL WHERE folder_status = 'pending' AND client_folder_id IS NULL;
UPDATE public.matters SET folder_status = NULL WHERE folder_status = 'pending' AND application_folder_id IS NULL;
```

**File: `src/pages/migration/Clients.tsx`**

- In the **create mutation**: After inserting the client, if Drive IS connected, update the client's `folder_status` to `'pending'` before dispatching the webhook. If not connected, leave it as NULL.

- In the **UI (Drive Folder column)**: Add a case for `null` folder_status that shows a muted dash or "N/A" text instead of "Pending". The else/fallback "Pending" badge will only show for clients with explicit `folder_status = 'pending'`.

**File: `src/pages/migration/Clients.tsx` (type update)**
- Update the `Client` interface to allow `folder_status: string | null`
