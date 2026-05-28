/** Minimal Discord interaction shape. Only the fields we actually use. */
export type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
};

export type DiscordOption = {
  name: string;
  type: number;
  value?: string | number | boolean;
  focused?: boolean;
  options?: DiscordOption[];
};

export type DiscordInteraction = {
  id: string;
  type: number; // 1=PING, 2=APP_COMMAND, 4=AUTOCOMPLETE
  token: string;
  guild_id?: string;
  channel_id?: string;
  /** Present in guild interactions */
  member?: { user: DiscordUser };
  /** Present in DM interactions */
  user?: DiscordUser;
  data?: {
    id: string;
    name: string;
    options?: DiscordOption[];
  };
};

export type CommandHandler = (
  interaction: DiscordInteraction
) => Promise<Response>;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns the Discord user regardless of guild vs DM context. */
export function getUser(interaction: DiscordInteraction): DiscordUser | null {
  return interaction.member?.user ?? interaction.user ?? null;
}

/** Returns the string value of a named option, or null. */
export function getOption(
  interaction: DiscordInteraction,
  name: string
): string | null {
  const opt = interaction.data?.options?.find((o) => o.name === name);
  return opt?.value != null ? String(opt.value) : null;
}

/** Returns the option currently being autocompleted. */
export function getFocusedOption(
  interaction: DiscordInteraction
): DiscordOption | null {
  return interaction.data?.options?.find((o) => o.focused) ?? null;
}
