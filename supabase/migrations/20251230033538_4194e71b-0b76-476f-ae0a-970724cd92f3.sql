-- Add documents_received_folder_id column to clients table
ALTER TABLE public.clients 
ADD COLUMN documents_received_folder_id TEXT;