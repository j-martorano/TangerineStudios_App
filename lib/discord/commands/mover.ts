/**
 * /mover [proyecto] [fase]
 *
 * Moves a project to a new phase.
 * - Editors can only move their own projects.
 * - Joaco can move any project.
 * - After moving, notifies Joaco's channel.
 *
 * `proyecto` uses Discord autocomplete (type=4 interactions).
 * `fase` uses static choices defined in the command registration.
 */

import type { DiscordInteraction } from "../types";
import { getUser, getOption, getFocusedOption } from "../types";
import { reply, replyError, autocomplete } from "../respond";
import { PHASE_EMOJI, PHASE_LABEL, notifyProjectMoved } from "../notify";
import { createBotClient } from "@/lib/supabase/bot";

// Phases editors can move TO (excludes por_asignar — that's Joaco's job)
const MOVEABLE_PHASES = ["editando", "en_revision", "terminado"] as const;
type MoveablePhase = (typeof MOVEABLE_PHASES)[number];

// ── Autocomplete ────────────────────────────────────────────────────────────

export async function autocompleteMover(
  interaction: DiscordInteraction
): Promise<Response> {
  const user = getUser(interaction);
  if (!user) return autocomplete([]);

  const supabase = createBotClient();
  const isJoaco = user.id === process.env.DISCORD_JOACO_ID;
  const focused = getFocusedOption(interaction);

  // Only autocomplete the "proyecto" option, not "fase"
  if (focused?.name !== "proyecto") return autocomplete([]);

  const search = (focused.value ? String(focused.value) : "").toLowerCase();

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
    rows = (data ?? []) as Row[];
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
      search
        ? p.title.toLowerCase().includes(search) ||
          (p.client_name ?? "").toLowerCase().includes(search)
        : true
    )
    .slice(0, 25)
    .map((p) => {
      const emoji = PHASE_EMOJI[p.phase] ?? "?";
      const client = p.client_name ? ` — ${p.client_name}` : "";
      return {
        name: `${emoji} ${p.title}${client}`.slice(0, 100),
        value: p.id,
      };
    });

  return autocomplete(choices);
}

// ── Command ─────────────────────────────────────────────────────────────────

export async function handleMover(
  interaction: DiscordInteraction
): Promise<Response> {
  const user = getUser(interaction);
  if (!user) return replyError("No se pudo identificar tu usuario de Discord.");

  const projectId = getOption(interaction, "proyecto");
  const newPhase = getOption(interaction, "fase") as MoveablePhase | null;

  if (!projectId) return replyError("Tenés que seleccionar un proyecto.");
  if (!newPhase || !MOVEABLE_PHASES.includes(newPhase)) {
    return replyError("Fase inválida.");
  }

  const supabase = createBotClient();
  const isJoaco = user.id === process.env.DISCORD_JOACO_ID;

  // ── Resolve editor ──────────────────────────────────────────────────────
  let editorId: string | null = null;
  let editorName = "Joaco";

  if (!isJoaco) {
    const { data: editor } = await supabase
      .from("editors")
      .select("id, name")
      .eq("discord_id", user.id)
      .maybeSingle();

    if (!editor) {
      return replyError("No estás vinculado. Usá `/vincular [código]`.");
    }
    editorId = editor.id;
    editorName = editor.name;
  }

  // ── Fetch project ───────────────────────────────────────────────────────
  const { data: project, error: fetchErr } = await supabase
    .from("projects")
    .select("id, title, phase, client_name, archived")
    .eq("id", projectId)
    .maybeSingle();

  if (fetchErr || !project) {
    return replyError("Proyecto no encontrado.");
  }
  if (project.archived) {
    return replyError("Ese proyecto está archivado.");
  }

  // ── Permission check for editors ────────────────────────────────────────
  if (!isJoaco) {
    const { data: assignment } = await supabase
      .from("project_editors")
      .select("editor_id")
      .eq("project_id", projectId)
      .eq("editor_id", editorId!)
      .maybeSingle();

    if (!assignment) {
      return replyError("No tenés permiso para mover ese proyecto.");
    }
  }

  // ── No-op check ─────────────────────────────────────────────────────────
  if (project.phase === newPhase) {
    const label = PHASE_LABEL[newPhase] ?? newPhase;
    return reply(`ℹ️ **${project.title}** ya está en **${label}**.`);
  }

  // ── Update phase ─────────────────────────────────────────────────────────
  // Auto-set finalized_at when moving to terminado
  const isMovingToTerminado = newPhase === "terminado";
  const isMovingFromTerminado = project.phase === "terminado" && !isMovingToTerminado;

  const { error: updateErr } = await supabase
    .from("projects")
    .update({
      phase: newPhase,
      ...(isMovingToTerminado
        ? { finalized: true, finalized_at: new Date().toISOString() }
        : isMovingFromTerminado
        ? { finalized: false, finalized_at: null }
        : {}),
    })
    .eq("id", projectId);

  if (updateErr) {
    console.error("[discord:mover] update error:", updateErr);
    return replyError("Error al actualizar el proyecto. Intentá de nuevo.");
  }

  // ── Labels para la respuesta y la notificación ──────────────────────────
  const fromLabel = `${PHASE_EMOJI[project.phase] ?? "?"} ${PHASE_LABEL[project.phase] ?? project.phase}`;
  const toLabel   = `${PHASE_EMOJI[newPhase]      ?? "?"} ${PHASE_LABEL[newPhase]      ?? newPhase}`;

  // ── Notify Joaco ──────────────────────────────────────────────────────────
  // Direct fetch (proven reliable in serverless). The higher-level
  // notifyProjectMoved() helper had a silent failure in production.
  const notifyChannelId = process.env.DISCORD_NOTIFY_CHANNEL_ID;
  const notifyToken     = process.env.DISCORD_BOT_TOKEN;
  if (notifyChannelId && notifyToken) {
    await fetch(`https://discord.com/api/v10/channels/${notifyChannelId}/messages`, {
      method:  "POST",
      headers: {
        Authorization:  `Bot ${notifyToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        embeds: [{
          color:       0xf97316,
          title:       "Ver en Kanban →",
          url:         `https://tangerine-studios-app.vercel.app/kanban?focus=${project.id}`,
          description: `🔄 **${editorName}** movió **${project.title}**\n${fromLabel} → **${toLabel}**`,
          footer:      { text: project.client_name ?? `ID: ${project.id}` },
          timestamp:   new Date().toISOString(),
        }],
      }),
    }).catch((e) => console.error("[discord:mover] notify failed:", e));
  }

  // ── Confirm to editor ────────────────────────────────────────────────────
  const client = project.client_name ? ` *(${project.client_name})*` : "";

  return reply(
    `✅ **${project.title}**${client}\n${fromLabel} → **${toLabel}**`
  );
}
