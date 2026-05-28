-- Add discord_link_token to editors for one-time Discord account linking.
-- discord_id (already exists) stores the Discord snowflake once linked.
ALTER TABLE public.editors
  ADD COLUMN IF NOT EXISTS discord_link_token TEXT UNIQUE;
