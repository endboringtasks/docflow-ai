-- platform_audit_logs.user_id
ALTER TABLE public.platform_audit_logs DROP CONSTRAINT IF EXISTS platform_audit_logs_user_id_fkey;
ALTER TABLE public.platform_audit_logs ADD CONSTRAINT platform_audit_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- document_checklist.uploaded_by
ALTER TABLE public.document_checklist DROP CONSTRAINT IF EXISTS document_checklist_uploaded_by_fkey;
ALTER TABLE public.document_checklist ADD CONSTRAINT document_checklist_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- document_checklist.reviewed_by
ALTER TABLE public.document_checklist DROP CONSTRAINT IF EXISTS document_checklist_reviewed_by_fkey;
ALTER TABLE public.document_checklist ADD CONSTRAINT document_checklist_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- platform_admins.created_by
ALTER TABLE public.platform_admins DROP CONSTRAINT IF EXISTS platform_admins_created_by_fkey;
ALTER TABLE public.platform_admins ADD CONSTRAINT platform_admins_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- platform_webhooks.created_by
ALTER TABLE public.platform_webhooks DROP CONSTRAINT IF EXISTS platform_webhooks_created_by_fkey;
ALTER TABLE public.platform_webhooks ADD CONSTRAINT platform_webhooks_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- platform_settings.updated_by
ALTER TABLE public.platform_settings DROP CONSTRAINT IF EXISTS platform_settings_updated_by_fkey;
ALTER TABLE public.platform_settings ADD CONSTRAINT platform_settings_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;