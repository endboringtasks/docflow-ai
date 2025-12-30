-- Rename drive_folder_id to client_folder_id for consistency
ALTER TABLE public.clients 
RENAME COLUMN drive_folder_id TO client_folder_id;