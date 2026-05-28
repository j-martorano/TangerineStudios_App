/**
 * Command registry.
 *
 * To add a new command:
 *   1. Create lib/discord/commands/mycommand.ts with a handleMycommand export.
 *   2. Add it to COMMANDS below.
 *   3. Add it to COMMAND_DEFINITIONS in scripts/register-discord-commands.mjs.
 *   4. Run: node scripts/register-discord-commands.mjs
 */

import type { CommandHandler, DiscordInteraction } from "../types";
import { handleVincular } from "./vincular";
import { handleProyectos } from "./proyectos";
import { handleEstado } from "./estado";
import { handleMover } from "./mover";
import { autocompleteEstado } from "./estado";
import { autocompleteMover } from "./mover";
import { replyError } from "../respond";

// ── Command handlers ────────────────────────────────────────────────────────

export const COMMANDS: Record<string, CommandHandler> = {
  vincular: handleVincular,
  proyectos: handleProyectos,
  estado: handleEstado,
  mover: handleMover,
};

// ── Autocomplete handlers (keyed by command name) ───────────────────────────

const AUTOCOMPLETE: Record<
  string,
  (interaction: DiscordInteraction) => Promise<Response>
> = {
  estado: autocompleteEstado,
  mover: autocompleteMover,
};

// ── Dispatch ────────────────────────────────────────────────────────────────

/** Routes an APPLICATION_COMMAND interaction to the right handler. */
export async function dispatchCommand(
  interaction: DiscordInteraction
): Promise<Response> {
  const name = interaction.data?.name;
  if (!name) return replyError("Comando desconocido.");

  const handler = COMMANDS[name];
  if (!handler) return replyError(`Comando \`/${name}\` no reconocido.`);

  return handler(interaction);
}

/** Routes an AUTOCOMPLETE interaction to the right resolver. */
export async function dispatchAutocomplete(
  interaction: DiscordInteraction
): Promise<Response> {
  const name = interaction.data?.name;
  if (!name) return Response.json({ type: 8, data: { choices: [] } });

  const resolver = AUTOCOMPLETE[name];
  if (!resolver) return Response.json({ type: 8, data: { choices: [] } });

  return resolver(interaction);
}
