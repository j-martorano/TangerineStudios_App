-- Canal de Discord por cliente (para notificaciones de estado al cliente)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS discord_channel_id text;

-- Jerarquía padre/hijo entre clientes
-- Si se elimina el padre, los hijos se eliminan en cascada
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;
