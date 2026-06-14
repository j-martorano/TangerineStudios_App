/**
 * /terminar [proyecto] [url]
 *
 * Submits a project for review:
 * - Moves project to "en_revision"
 * - Saves the review URL as a new revision in project_revisions
 * - Notifies the internal channel (Joaco) with the revision URL
 * - Notifies the client's Discord channel of the phase change
 */

import type { DiscordInteraction } from "../types";
import { getUser, getOption, getFocusedOption } from "../types";
import { reply, replyError, autocomplete } from "../respond";
import { PHASE_EMOJI, PHASE_LABEL, notifyRevisionSubmitted, notifyClientPhaseChange } from "../notify";
import { createBotClient } from "@/lib/supabase/bot";

// ── Autocomplete ────────────────────────────────────────────────────────────

export async function autocompleteTerminar(
  interaction: DiscordInteraction
): Promise<Response> {
  const user = getUser(interaction);
  if (!user) return autocomplete([]);

  const focused = getFocusedOption(interaction);
  if (focused?.name !== "proyecto") return autocomplete([]);

  const search = (focused.value ? String(focused.value) : "").toLowerCase();
  const supabase = createBotClient();
  const isJoaco = user.id === process.env.DISCORD_JOACO_ID;

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

export async function handleTerminar(
  interaction: DiscordInteraction
): Promise<Response> {
  const user = getUser(interaction);
  if (!user) return replyError("No se pudo identificar tu usuario de Discord.");

  const projectId = getOption(interaction, "proyecto");
  const url = getOption(interaction, "url")?.trim();

  if (!projectId) return replyError("Tenés que seleccionar un proyecto.");
  if (!url) return replyError("Tenés que ingresar el link de revisión.");

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
  const { data: project } = await supabase
    .from("projects")
    .select("id, title, phase, client_name, archived, client:clients(id, name, discord_channel_id)")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) return replyError("Proyecto no encontrado.");
  if (project.archived) return replyError("Ese proyecto está archivado.");

  // ── Permission check for editors ────────────────────────────────────────
  if (!isJoaco) {
    const { data: assignment } = await supabase
      .from("project_editors")
      .select("editor_id")
      .eq("project_id", projectId)
      .eq("editor_id", editorId!)
      .maybeSingle();

    if (!assignment) {
      return replyError("No tenés permiso para entregar ese proyecto.");
    }
  }

  // ── Get next revision number ────────────────────────────────────────────
  const { data: lastRevision } = await supabase
    .from("project_revisions")
    .select("revision_number")
    .eq("project_id", projectId)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const revisionNumber = (lastRevision?.revision_number ?? 0) + 1;

  // ── Insert revision ─────────────────────────────────────────────────────
  const { error: revErr } = await supabase
    .from("project_revisions")
    .insert({
      project_id: projectId,
      revision_number: revisionNumber,
      url,
      editor_id: editorId,
    });

  if (revErr) {
    console.error("[discord:terminar] revision insert error:", revErr);
    return replyError("Error al guardar la revisión. Intentá de nuevo.");
  }

  // ── Move project to en_revision ─────────────────────────────────────────
  const fromPhase = project.phase;
  const { error: updateErr } = await supabase
    .from("projects")
    .update({
      phase: "en_revision",
      // If moving back from terminado, clear finalized state
      ...(fromPhase === "terminado" ? { finalized: false, finalized_at: null } : {}),
    })
    .eq("id", projectId);

  if (updateErr) {
    console.error("[discord:terminar] update error:", updateErr);
    return replyError("Error al actualizar el proyecto. Intentá de nuevo.");
  }

  const client = project.client as { id: string; name: string; discord_channel_id: string | null } | null;
  const clientName = client?.name ?? project.client_name ?? undefined;

  // ── Notify internal channel (Joaco) ────────────────────────────────────
  await notifyRevisionSubmitted({
    projectTitle: project.title,
    projectId,
    editorName,
    revisionNumber,
    url,
    clientName,
  });

  // ── Notify client's Discord channel ────────────────────────────────────
  if (client?.discord_channel_id && fromPhase !== "en_revision") {
    await notifyClientPhaseChange({
      projectTitle: project.title,
      projectId,
      clientChannelId: client.discord_channel_id,
      fromPhase,
      toPhase: "en_revision",
      clientName: client.name,
    });
  }

  // ── Reply to editor ─────────────────────────────────────────────────────
  const clientLabel = clientName ? ` *(${clientName})*` : "";
  return reply(
    `✅ **${project.title}**${clientLabel}\nRevisión ${revisionNumber} enviada — Joaco será notificado.`
  );
}
