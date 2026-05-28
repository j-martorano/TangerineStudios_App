/**
 * /estado [proyecto]
 *
 * Shows detailed info about a specific project.
 * Editors can only view their own projects; Joaco can view any.
 *
 * The `proyecto` option uses Discord autocomplete — Discord calls this
 * same handler with type=4 (AUTOCOMPLETE) to populate the dropdown.
 */

import type { DiscordInteraction } from "../types";
import { getUser, getOption, getFocusedOption } from "../types";
import { reply, replyError, autocomplete } from "../respond";
import { PHASE_EMOJI, PHASE_LABEL } from "../notify";
import { createBotClient } from "@/lib/supabase/bot";

// ── Autocomplete ────────────────────────────────────────────────────────────

export async function autocompleteEstado(
  interaction: DiscordInteraction
): Promise<Response> {
  const user = getUser(interaction);
  if (!user) return autocomplete([]);

  const supabase = createBotClient();
  const isJoaco = user.id === process.env.DISCORD_JOACO_ID;
  const focused = getFocusedOption(interaction);
  const search = (focused?.value ? String(focused.value) : "").toLowerCase();

  type Row = { id: string; title: string; client_name: string | null; phase: string };
  let rows: Row[] = [];

  if (isJoaco) {
    const { data } = await supabase
      .from("projects")
      .select("id, title, client_name, phase")
      .eq("archived", false)
      .order("phase")
      .order("position")
      .limit(25);
    rows = (data ?? []) as unknown as Row[];
  } else {
    const { data: editor } = await supabase
      .from("editors")
      .select("id")
      .eq("discord_id", user.id)
      .maybeSingle();
    if (!editor) return autocomplete([]);

    const { data: assignments } = await supabase
      .from("project_editors")
      .select("project:projects(id, title, client_name, phase, archived)")
      .eq("editor_id", editor.id);

    rows = ((assignments ?? [])
      .map((a) => a.project)
      .filter((p) => p != null && !(p as { archived?: boolean }).archived)
    ) as unknown as Row[];
  }

  const choices = rows
    .filter((p) =>
      search ? p.title.toLowerCase().includes(search) || (p.client_name ?? "").toLowerCase().includes(search) : true
    )
    .slice(0, 25)
    .map((p) => {
      const emoji = PHASE_EMOJI[p.phase] ?? "?";
      const client = p.client_name ? ` — ${p.client_name}` : "";
      return { name: `${emoji} ${p.title}${client}`.slice(0, 100), value: p.id };
    });

  return autocomplete(choices);
}

// ── Command ─────────────────────────────────────────────────────────────────

export async function handleEstado(
  interaction: DiscordInteraction
): Promise<Response> {
  const user = getUser(interaction);
  if (!user) return replyError("No se pudo identificar tu usuario de Discord.");

  const projectId = getOption(interaction, "proyecto");
  if (!projectId) return replyError("Tenés que seleccionar un proyecto.");

  const supabase = createBotClient();
  const isJoaco = user.id === process.env.DISCORD_JOACO_ID;

  // Resolve editor
  let editorId: string | null = null;
  if (!isJoaco) {
    const { data: editor } = await supabase
      .from("editors")
      .select("id")
      .eq("discord_id", user.id)
      .maybeSingle();
    if (!editor) {
      return replyError("No estás vinculado. Usá `/vincular [código]`.");
    }
    editorId = editor.id;
  }

  // Fetch project
  const { data: project, error } = await supabase
    .from("projects")
    .select(
      "id, title, phase, client_name, duration_minutes, price, cobrado, pagado, finalized_at, project_code"
    )
    .eq("id", projectId)
    .eq("archived", false)
    .maybeSingle();

  if (error || !project) {
    return replyError("Proyecto no encontrado.");
  }

  // Permission check for editors
  if (!isJoaco) {
    const { data: assignment } = await supabase
      .from("project_editors")
      .select("editor_id")
      .eq("project_id", projectId)
      .eq("editor_id", editorId!)
      .maybeSingle();

    if (!assignment) {
      return replyError("No tenés acceso a ese proyecto.");
    }
  }

  // Format response
  const phase = project.phase as string;
  const emoji = PHASE_EMOJI[phase] ?? "?";
  const label = PHASE_LABEL[phase] ?? phase;
  const code = project.project_code ? `\`${project.project_code}\`` : "";
  const duration = project.duration_minutes
    ? `${project.duration_minutes} min`
    : "—";

  const lines = [
    `${emoji} **${project.title}** ${code}`,
    `📁 Cliente: ${project.client_name ?? "Sin asignar"}`,
    `🎯 Fase: **${label}**`,
    `⏱️ Duración: ${duration}`,
  ];

  if (project.finalized_at) {
    lines.push(`📅 Finalizado: ${formatDate(project.finalized_at)}`);
  }

  return reply(lines.join("\n"));
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
