/**
 * Supabase client for the Discord bot.
 * Uses the service role key to bypass RLS — only call from trusted server code
 * (API routes, server actions). Never expose this client to the browser.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export function createBotClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
    );
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
}
