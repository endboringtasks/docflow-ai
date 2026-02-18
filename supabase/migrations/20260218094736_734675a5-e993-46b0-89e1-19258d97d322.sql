
ALTER TABLE public.clients 
  ALTER COLUMN folder_status DROP NOT NULL,
  ALTER COLUMN folder_status SET DEFAULT NULL,
  DROP CONSTRAINT IF EXISTS clients_folder_status_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_folder_status_check 
  CHECK (folder_status IS NULL OR folder_status IN ('pending', 'creating', 'created', 'failed'));

ALTER TABLE public.visa_applications 
  ALTER COLUMN folder_status DROP NOT NULL,
  ALTER COLUMN folder_status SET DEFAULT NULL,
  DROP CONSTRAINT IF EXISTS matters_folder_status_check;

ALTER TABLE public.visa_applications
  ADD CONSTRAINT matters_folder_status_check 
  CHECK (folder_status IS NULL OR folder_status IN ('pending', 'creating', 'created', 'failed'));

UPDATE public.clients SET folder_status = NULL WHERE folder_status = 'pending' AND client_folder_id IS NULL;
UPDATE public.visa_applications SET folder_status = NULL WHERE folder_status = 'pending' AND visa_application_folder_id IS NULL;
