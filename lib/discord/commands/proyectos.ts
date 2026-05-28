/**
 * /proyectos
 *
 * Lists active projects for the calling editor.
 * Joaco sees all projects; editors see only their assigned ones.
 */

import type { DiscordInteraction } from "../types";
import { getUser } from "../types";
import { reply, replyError } from "../respond";
import { PHASE_EMOJI } from "../notify";
import { createBotClient } from "@/lib/supabase/bot";

export async function handleProyectos(
  interaction: DiscordInteraction
): Promise<Response> {
  const user = getUser(interaction);
  if (!user) return replyError("No se pudo identificar tu usuario de Discord.");

  const supabase = createBotClient();
  const isJoaco = user.id === process.env.DISCORD_JOACO_ID;

  // ── Resolve editor ──────────────────────────────────────────────────────
  let editorId: string | null = null;
  let displayName = "Joaco";

  if (!isJoaco) {
    const { data: editor } = await supabase
      .from("editors")
      .select("id, name")
      .eq("discord_id", user.id)
      .maybeSingle();

    if (!editor) {
      return replyError(
        "No estás vinculado al bot.\nPedile a Joaco tu código de vinculación y usá `/vincular [código]`."
      );
    }
    editorId = editor.id;
    displayName = editor.name;
  }

  // ── Fetch projects ──────────────────────────────────────────────────────
  type ProjectRow = {
    id: string;
    title: string;
    phase: string;
    client_name: string | null;
  };

  let projects: ProjectRow[] = [];

  if (isJoaco) {
    const { data } = await supabase
      .from("projects")
      .select("id, title, phase, client_name")
      .eq("archived", false)
      .order("phase")
      .order("position");
    projects = (data ?? []) as ProjectRow[];
  } else {
    // Get projects where this editor is assigned
    const { data: assignments } = await supabase
      .from("project_editors")
      .select("project:projects(id, title, phase, client_name, archived)")
      .eq("editor_id", editorId!);

    projects = ((assignments ?? [])
      .map((a) => a.project)
      .filter((p) => p != null && !(p as { archived?: boolean }).archived)
    ) as unknown as ProjectRow[];
  }

  if (projects.length === 0) {
    const msg = isJoaco
      ? "No hay proyectos activos."
      : "No tenés proyectos asignados actualmente.";
    return reply(`📭 ${msg}`);
  }

  // ── Format response ─────────────────────────────────────────────────────
  // Group by phase
  const byPhase: Record<string, ProjectRow[]> = {};
  for (const p of projects) {
    if (!byPhase[p.phase]) byPhase[p.phase] = [];
    byPhase[p.phase].push(p);
  }

  const PHASE_ORDER = ["editando", "en_revision", "por_asignar", "terminado"];
  const lines: string[] = [];

  for (const phase of PHASE_ORDER) {
    const group = byPhase[phase];
    if (!group?.length) continue;
    const emoji = PHASE_EMOJI[phase] ?? "❓";
    lines.push(`**${emoji} ${formatPhase(phase)}**`);
    for (const p of group) {
      const client = p.client_name ? ` — ${p.client_name}` : "";
      lines.push(`  • ${p.title}${client}`);
    }
  }

  const header = isJoaco
    ? `📋 **Proyectos activos** (${projects.length})\n`
    : `📋 **Proyectos de ${displayName}** (${projects.length})\n`;

  let content = header + lines.join("\n");

  // Discord message limit is 2000 chars
  if (content.length > 1900) {
    content = content.slice(0, 1870) + "\n…*(hay más — consultá en la web)*";
  }

  return reply(content);
}

function formatPhase(phase: string): string {
  const labels: Record<string, string> = {
    por_asignar: "Por asignar",
    editando: "Editando",
    en_revision: "En revisión",
    terminado: "Terminado",
  };
  return labels[phase] ?? phase;
}
