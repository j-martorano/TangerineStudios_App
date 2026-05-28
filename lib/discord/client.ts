/**
 * Thin wrapper around the Discord REST API.
 * All bot-authenticated calls go through `discordFetch`.
 */

const DISCORD_API = "https://discord.com/api/v10";

export async function discordFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

/** Send a message to a channel. Fire-and-forget for notifications. */
export async function sendChannelMessage(
  channelId: string,
  payload: { content?: string; embeds?: object[] }
): Promise<void> {
  const res = await discordFetch(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[discord:client] sendChannelMessage failed ${res.status}: ${text}`);
  }
}

/**
 * Follow-up response to a deferred interaction.
 * Use after responding with type 5 (DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE).
 */
export async function sendFollowUp(
  token: string,
  payload: { content?: string; embeds?: object[]; flags?: number }
): Promise<void> {
  const appId = process.env.DISCORD_APPLICATION_ID!;
  const res = await discordFetch(`/webhooks/${appId}/${token}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[discord:client] sendFollowUp failed ${res.status}: ${text}`);
  }
}
