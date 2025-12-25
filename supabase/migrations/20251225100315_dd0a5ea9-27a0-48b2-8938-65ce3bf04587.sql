-- Mark the stuck clients as 'failed' so the retry button appears
UPDATE public.clients 
SET folder_status = 'failed'
WHERE id IN (
  '9c02200c-6c8e-4781-9e57-5ec85f047854',
  '02febb12-192d-44ad-a85d-75ac3b68ff6d'
);