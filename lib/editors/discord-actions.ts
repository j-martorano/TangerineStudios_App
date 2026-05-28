"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; token?: string } | { ok: false; error: string };

/** Generates (or regenerates) a Discord link token for an editor. */
export async function generateDiscordLinkToken(editorId: string): Promise<Result> {
  if (!editorId) return { ok: false, error: "ID de editor inválido" };

  const supabase = await createClient();

  // Generate a random 8-char uppercase token (e.g. "7X4K9QMN")
  const token = Array.from(crypto.getRandomValues(new Uint8Array(5)))
    .map((b) => b.toString(36).toUpperCase())
    .join("")
    .slice(0, 8)
    .padEnd(8, "X");

  const { error } = await supabase
    .from("editors")
    .update({ discord_link_token: token })
    .eq("id", editorId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/editors");
  return { ok: true, token };
}

/** Removes a Discord link (discord_id + token) from an editor. */
export async function revokeDiscordLink(editorId: string): Promise<Result> {
  if (!editorId) return { ok: false, error: "ID de editor inválido" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("editors")
    .update({ discord_id: null, discord_link_token: null })
    .eq("id", editorId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/editors");
  return { ok: true };
}
