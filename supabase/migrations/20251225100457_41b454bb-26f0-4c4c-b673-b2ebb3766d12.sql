-- Add timestamp column to track when folder_status was changed to 'creating'
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS folder_status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

ALTER TABLE public.matters 
ADD COLUMN IF NOT EXISTS folder_status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update existing 'creating' records to use created_at as fallback
UPDATE public.clients 
SET folder_status_updated_at = created_at 
WHERE folder_status_updated_at IS NULL;

UPDATE public.matters 
SET folder_status_updated_at = created_at 
WHERE folder_status_updated_at IS NULL;

-- Add comment
COMMENT ON COLUMN public.clients.folder_status_updated_at IS 'Timestamp when folder_status was last changed to creating. Used for timeout detection.';
COMMENT ON COLUMN public.matters.folder_status_updated_at IS 'Timestamp when folder_status was last changed to creating. Used for timeout detection.';