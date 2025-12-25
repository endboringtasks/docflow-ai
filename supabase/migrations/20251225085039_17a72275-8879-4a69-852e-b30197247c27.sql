-- Add folder_status column to clients table
ALTER TABLE public.clients 
ADD COLUMN folder_status TEXT NOT NULL DEFAULT 'pending' 
CHECK (folder_status IN ('pending', 'creating', 'created', 'failed'));

-- Add folder_status column to matters table
ALTER TABLE public.matters 
ADD COLUMN folder_status TEXT NOT NULL DEFAULT 'pending' 
CHECK (folder_status IN ('pending', 'creating', 'created', 'failed'));

-- Update existing records that have folder IDs to 'created' status
UPDATE public.clients SET folder_status = 'created' WHERE drive_folder_id IS NOT NULL;
UPDATE public.matters SET folder_status = 'created' WHERE drive_folder_id IS NOT NULL;