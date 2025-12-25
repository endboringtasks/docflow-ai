-- Enable realtime for clients and matters tables
ALTER TABLE public.clients REPLICA IDENTITY FULL;
ALTER TABLE public.matters REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matters;