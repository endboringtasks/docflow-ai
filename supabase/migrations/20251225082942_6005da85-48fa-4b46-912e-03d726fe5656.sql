-- Schedule hourly cleanup of rate limit records
SELECT cron.schedule(
  'cleanup-rate-limits-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://wevdjmdlsrljanttykzu.supabase.co/functions/v1/cleanup-rate-limits',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndldmRqbWRsc3JsamFudHR5a3p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNDI3NTEsImV4cCI6MjA4MTkxODc1MX0.kucbr1-8eeMmrJPx4TFn2TMtNfl2e0EA7MkiXskOvlI"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);