/**
 * POST /api/discord/interactions
 *
 * Entry point for all Discord slash command interactions.
 * Discord requires this endpoint to:
 *   1. Verify the Ed25519 signature on every request.
 *   2. Respond to PING (type 1) with PONG (type 1) for the URL verification step.
 *   3. Dispatch APPLICATION_COMMAND (type 2) and AUTOCOMPLETE (type 4) interactions.
 */

import { verifyDiscordRequest } from "@/lib/discord/verify";
import { pong } from "@/lib/discord/respond";
import { dispatchCommand, dispatchAutocomplete } from "@/lib/discord/commands/index";
import type { DiscordInteraction } from "@/lib/discord/types";

// Discord interaction types
const PING = 1;
const APPLICATION_COMMAND = 2;
const AUTOCOMPLETE = 4;

export async function POST(req: Request): Promise<Response> {
  // 1. Verify signature
  const { valid, body } = await verifyDiscordRequest(req);
  if (!valid) {
    return new Response("Invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(body) as DiscordInteraction;

  // 2. PING — used by Discord during URL verification in the developer portal
  if (interaction.type === PING) {
    return pong();
  }

  // 3. Slash commands
  if (interaction.type === APPLICATION_COMMAND) {
    return dispatchCommand(interaction);
  }

  // 4. Autocomplete
  if (interaction.type === AUTOCOMPLETE) {
    return dispatchAutocomplete(interaction);
  }

  return new Response("Unknown interaction type", { status: 400 });
}
