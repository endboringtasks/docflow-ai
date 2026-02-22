
-- Step 1: Add sync columns to document_attachments
ALTER TABLE public.document_attachments
  ADD COLUMN IF NOT EXISTS storage_object_path TEXT,
  ADD COLUMN IF NOT EXISTS drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_app_folder_file_id TEXT,
  ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sync_error TEXT,
  ADD COLUMN IF NOT EXISTS sync_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_sync_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'storage';

-- Step 2: Add same columns to document_attachment_history
ALTER TABLE public.document_attachment_history
  ADD COLUMN IF NOT EXISTS storage_object_path TEXT,
  ADD COLUMN IF NOT EXISTS drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_app_folder_file_id TEXT,
  ADD COLUMN IF NOT EXISTS sync_status TEXT,
  ADD COLUMN IF NOT EXISTS sync_error TEXT,
  ADD COLUMN IF NOT EXISTS sync_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Step 3: Add CHECK constraints via validation triggers (not CHECK constraints, per guidelines)
CREATE OR REPLACE FUNCTION public.validate_sync_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sync_status NOT IN ('pending', 'processing', 'synced', 'failed', 'waiting_for_drive', 'not_applicable') THEN
    RAISE EXCEPTION 'Invalid sync_status: %. Allowed values: pending, processing, synced, failed, waiting_for_drive, not_applicable', NEW.sync_status;
  END IF;
  IF NEW.source NOT IN ('storage', 'drive') THEN
    RAISE EXCEPTION 'Invalid source: %. Allowed values: storage, drive', NEW.source;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_document_attachment_sync
  BEFORE INSERT OR UPDATE ON public.document_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_sync_status();

-- Step 4: Backfill existing records with drive:// paths
UPDATE public.document_attachments
SET 
  source = 'drive',
  sync_status = 'not_applicable',
  drive_file_id = substring(file_path from 'drive://(.+)')
WHERE file_path LIKE 'drive://%';

-- Also backfill records that don't start with drive:// (legacy Supabase Storage files)
UPDATE public.document_attachments
SET 
  source = 'storage',
  sync_status = 'not_applicable',
  storage_object_path = file_path
WHERE file_path IS NOT NULL AND file_path NOT LIKE 'drive://%';

-- Step 5: Add UPDATE RLS policy for document_attachments (needed for sync status updates)
CREATE POLICY "Company members can update document attachments"
  ON public.document_attachments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM document_checklist dc
      JOIN visa_applications va ON va.id = dc.visa_application_id
      WHERE dc.id = document_attachments.document_checklist_id
        AND is_company_member(auth.uid(), va.company_id)
    )
  );

-- Step 6: Add INSERT policy for document_attachment_history (needed for archival)
CREATE POLICY "Service role can insert document history"
  ON public.document_attachment_history
  FOR INSERT
  WITH CHECK (true);

-- Step 7: Create index for sync-to-drive queries
CREATE INDEX IF NOT EXISTS idx_document_attachments_sync_status
  ON public.document_attachments (sync_status, sync_attempts, created_at)
  WHERE sync_status IN ('pending', 'failed');

-- Step 8: Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_document_attachments_synced_cleanup
  ON public.document_attachments (synced_at)
  WHERE sync_status = 'synced' AND storage_object_path IS NOT NULL;
