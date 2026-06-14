/**
 * Reusable notification helpers for the Discord bot.
 *
 * Base: notifyChannel() — sends any content/embeds to a channel.
 * Specific helpers build on top of it.
 *
 * All functions are fire-and-forget: they log errors but never throw,
 * so a Discord outage never breaks a user-facing operation.
 */

import { sendChannelMessage } from "./client";

// ── Colours ────────────────────────────────────────────────────────────────
const COLORS = {
  orange: 0xf97316,
  green: 0x22c55e,
  blue: 0x3b82f6,
  red: 0xef4444,
  purple: 0xa855f7,
} as const;

// ── Phase labels ───────────────────────────────────────────────────────────
const PHASE_LABEL: Record<string, string> = {
  por_asignar: "Por asignar",
  editando: "Editando",
  en_revision: "En revisión",
  terminado: "Terminado",
};

const PHASE_EMOJI: Record<string, string> = {
  por_asignar: "⏳",
  editando: "🎬",
  en_revision: "🔍",
  terminado: "✅",
};

export { PHASE_LABEL, PHASE_EMOJI };

// ── Base ───────────────────────────────────────────────────────────────────

export type NotifyOptions = {
  /** Defaults to env DISCORD_NOTIFY_CHANNEL_ID */
  channelId?: string;
  content?: string;
  embeds?: object[];
};

/** Send any message to a Discord channel. Never throws. */
export async function notifyChannel(opts: NotifyOptions): Promise<void> {
  const channelId = opts.channelId ?? process.env.DISCORD_NOTIFY_CHANNEL_ID;
  if (!channelId) {
    console.warn("[discord:notify] No channelId configured, skipping notification");
    return;
  }
  try {
    await sendChannelMessage(channelId, {
      content: opts.content,
      embeds: opts.embeds,
    });
  } catch (e) {
    console.error("[discord:notify] Failed to send notification:", e);
  }
}

// ── Specific notifications ─────────────────────────────────────────────────

/** Notifies Joaco when an editor moves a project via the bot. */
export async function notifyProjectMoved(opts: {
  projectTitle: string;
  projectId: string;
  editorName: string;
  fromPhase: string;
  toPhase: string;
  channelId?: string;
}): Promise<void> {
  const from = `${PHASE_EMOJI[opts.fromPhase] ?? "?"} ${PHASE_LABEL[opts.fromPhase] ?? opts.fromPhase}`;
  const to = `${PHASE_EMOJI[opts.toPhase] ?? "?"} ${PHASE_LABEL[opts.toPhase] ?? opts.toPhase}`;

  await notifyChannel({
    channelId: opts.channelId,
    embeds: [
      {
        color: COLORS.orange,
        description: `🔄 **${opts.editorName}** movió **${opts.projectTitle}**\n${from} → **${to}**`,
        footer: { text: `ID: ${opts.projectId}` },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

/** Notifies Joaco when a new editor links their Discord account. */
export async function notifyEditorLinked(opts: {
  editorName: string;
  discordUsername: string;
  channelId?: string;
}): Promise<void> {
  await notifyChannel({
    channelId: opts.channelId,
    embeds: [
      {
        color: COLORS.green,
        description: `🔗 **${opts.editorName}** vinculó su cuenta de Discord (@${opts.discordUsername})`,
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

/** Notifies a client's Discord channel when a project changes phase. */
export async function notifyClientPhaseChange(opts: {
  projectTitle: string;
  projectId: string;
  clientChannelId: string;
  fromPhase: string;
  toPhase: string;
  clientName?: string;
}): Promise<void> {
  const isTerminado = opts.toPhase === "terminado";
  const fromLabel = `${PHASE_EMOJI[opts.fromPhase] ?? "?"} ${PHASE_LABEL[opts.fromPhase] ?? opts.fromPhase}`;
  const toLabel   = `${PHASE_EMOJI[opts.toPhase]   ?? "?"} ${PHASE_LABEL[opts.toPhase]   ?? opts.toPhase}`;

  const description = isTerminado
    ? `✅ ¡El proyecto **${opts.projectTitle}** ha sido terminado! 🎉`
    : `🔄 El proyecto **${opts.projectTitle}** pasó de ${fromLabel} a **${toLabel}**`;

  await notifyChannel({
    channelId: opts.clientChannelId,
    embeds: [
      {
        color: isTerminado ? COLORS.green : COLORS.blue,
        title: "Ver en Kanban →",
        url: `https://tangerine-studios-app.vercel.app/kanban?focus=${opts.projectId}`,
        description,
        footer: opts.clientName ? { text: opts.clientName } : undefined,
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

/** Notifies the internal channel when an editor submits a project for review via /terminar. */
export async function notifyRevisionSubmitted(opts: {
  projectTitle: string;
  projectId: string;
  editorName: string;
  revisionNumber: number;
  url: string;
  clientName?: string;
}): Promise<void> {
  await notifyChannel({
    embeds: [
      {
        color: COLORS.blue,
        title: "Ver revisión →",
        url: opts.url,
        description: `🔍 **${opts.editorName}** envió **${opts.projectTitle}** a revisión\nRevisión ${opts.revisionNumber}: ${opts.url}`,
        footer: { text: opts.clientName ?? `ID: ${opts.projectId}` },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
