-- Add tokens_encrypted column to track which tokens are encrypted
ALTER TABLE public.google_drive_connections 
ADD COLUMN IF NOT EXISTS tokens_encrypted boolean DEFAULT false;