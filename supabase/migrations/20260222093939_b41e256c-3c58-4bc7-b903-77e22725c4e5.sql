
-- Schedule sync-to-drive every 2 minutes
SELECT cron.schedule(
  'sync-to-drive-every-2min',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wevdjmdlsrljanttykzu.supabase.co/functions/v1/sync-to-drive',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndldmRqbWRsc3JsamFudHR5a3p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNDI3NTEsImV4cCI6MjA4MTkxODc1MX0.kucbr1-8eeMmrJPx4TFn2TMtNfl2e0EA7MkiXskOvlI"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule cleanup-synced-storage daily at 3am UTC
SELECT cron.schedule(
  'cleanup-synced-storage-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wevdjmdlsrljanttykzu.supabase.co/functions/v1/cleanup-synced-storage',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndldmRqbWRsc3JsamFudHR5a3p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNDI3NTEsImV4cCI6MjA4MTkxODc1MX0.kucbr1-8eeMmrJPx4TFn2TMtNfl2e0EA7MkiXskOvlI"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
