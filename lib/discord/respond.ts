/**
 * Builders for Discord InteractionResponse objects.
 * https://discord.com/developers/docs/interactions/receiving-and-responding
 */

/** Discord interaction response types */
const T = {
  PONG: 1,
  CHANNEL_MESSAGE: 4,
  DEFERRED_CHANNEL_MESSAGE: 5,
  AUTOCOMPLETE: 8,
} as const;

const EPHEMERAL = 64; // flag: only visible to the invoking user

/** Responds to Discord's PING handshake. */
export function pong(): Response {
  return Response.json({ type: T.PONG });
}

/**
 * Sends an immediate text reply.
 * @param ephemeral  Default true — only visible to the user who ran the command.
 */
export function reply(content: string, ephemeral = true): Response {
  return Response.json({
    type: T.CHANNEL_MESSAGE,
    data: { content, flags: ephemeral ? EPHEMERAL : 0 },
  });
}

/**
 * Acknowledges the interaction immediately, then send the real content
 * via `sendFollowUp()` from discord/client.ts (up to 15 min later).
 * Use when the operation might take > 3 seconds.
 */
export function defer(ephemeral = true): Response {
  return Response.json({
    type: T.DEFERRED_CHANNEL_MESSAGE,
    data: { flags: ephemeral ? EPHEMERAL : 0 },
  });
}

/** Returns autocomplete choices for a slash command option. */
export function autocomplete(
  choices: { name: string; value: string }[]
): Response {
  return Response.json({
    type: T.AUTOCOMPLETE,
    data: { choices: choices.slice(0, 25) }, // Discord caps at 25
  });
}

/** Shorthand for a visible error message (ephemeral). */
export function replyError(message: string): Response {
  return reply(`❌ ${message}`, true);
}
