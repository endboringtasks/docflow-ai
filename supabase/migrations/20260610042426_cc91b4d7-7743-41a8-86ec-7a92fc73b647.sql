create or replace function public.get_webhook_log_endpoints()
returns table (endpoint text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct wrl.endpoint
  from public.webhook_request_logs wrl
  where wrl.endpoint is not null
    and public.is_platform_admin(auth.uid())
  order by wrl.endpoint
$$;

grant execute on function public.get_webhook_log_endpoints() to authenticated;