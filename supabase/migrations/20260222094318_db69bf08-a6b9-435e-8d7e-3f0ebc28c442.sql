
-- Seed default configurable parameters into platform_settings
-- ON CONFLICT DO NOTHING preserves any existing overrides
INSERT INTO public.platform_settings (key, value, description, is_secret)
VALUES 
  ('upload_max_file_size_mb', '{"value": 25}', 'Maximum file upload size in MB', false),
  ('upload_signed_url_expiry_seconds', '{"value": 600}', 'Signed upload URL expiry in seconds', false),
  ('upload_rate_limit_ip', '{"value": 50}', 'Max upload requests per IP per 5 minutes', false),
  ('upload_rate_limit_token', '{"value": 10}', 'Max upload requests per token per 5 minutes', false),
  ('sync_batch_size', '{"value": 10}', 'Number of attachments to sync per batch', false),
  ('sync_max_attempts', '{"value": 5}', 'Maximum sync retry attempts before giving up', false),
  ('storage_retention_days', '{"value": 30}', 'Days to keep storage objects after Drive sync', false)
ON CONFLICT (key) DO NOTHING;
