
ALTER TABLE public.google_drive_connections 
ADD COLUMN disconnected_at timestamptz DEFAULT NULL;
