/**
 * Registers (or updates) all slash commands for the Discord bot.
 * Run once after creating the bot, and again whenever commands change.
 *
 * Usage:
 *   node scripts/register-discord-commands.mjs
 *
 * Reads DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID
 * from .env.local (via --env-file flag) or from the process environment.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Load .env.local manually (Node < 20.6 doesn't support --env-file) ──────
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try {
  const env = readFileSync(resolve(ROOT, ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // No .env.local — rely on actual environment variables
}

const APP_ID = process.env.DISCORD_APPLICATION_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!APP_ID || !BOT_TOKEN || !GUILD_ID) {
  console.error("Missing env vars: DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID");
  process.exit(1);
}

// ── Command definitions ─────────────────────────────────────────────────────
const COMMANDS = [
  {
    name: "vincular",
    description: "Vincula tu cuenta de Discord con la app de TangerineStudios",
    options: [
      {
        name: "código",
        description: "El código que te dio Joaco (ej: 7X4K9QMN)",
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: "proyectos",
    description: "Lista tus proyectos activos",
  },
  {
    name: "ayuda",
    description: "Muestra los comandos disponibles",
  },
  {
    name: "estado",
    description: "Ver el estado de un proyecto",
    options: [
      {
        name: "proyecto",
        description: "El proyecto a consultar",
        type: 3, // STRING
        required: true,
        autocomplete: true,
      },
    ],
  },
  {
    name: "mover",
    description: "Mover un proyecto a otra fase",
    options: [
      {
        name: "proyecto",
        description: "El proyecto a mover",
        type: 3, // STRING
        required: true,
        autocomplete: true,
      },
      {
        name: "fase",
        description: "La nueva fase",
        type: 3, // STRING
        required: true,
        choices: [
          { name: "🎬 Editando", value: "editando" },
          { name: "🔍 En revisión", value: "en_revision" },
          { name: "✅ Terminado", value: "terminado" },
        ],
      },
    ],
  },
];

// ── 1. Register as GLOBAL commands (work in DMs + all servers) ───────────────
// Global commands take up to 1 hour to propagate to all clients.
const globalUrl = `https://discord.com/api/v10/applications/${APP_ID}/commands`;

const globalRes = await fetch(globalUrl, {
  method: "PUT",
  headers: { Authorization: `Bot ${BOT_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify(COMMANDS),
});

if (!globalRes.ok) {
  const text = await globalRes.text();
  console.error(`❌ Failed to register global commands (${globalRes.status}):`, text);
  process.exit(1);
}

const globalData = await globalRes.json();
console.log(`✅ Global commands registered (${globalData.length}):`);
for (const cmd of globalData) console.log(`   /${cmd.name}`);

// ── 2. Delete old guild-scoped commands (avoid duplicates) ────────────────────
if (GUILD_ID) {
  const guildUrl = `https://discord.com/api/v10/applications/${APP_ID}/guilds/${GUILD_ID}/commands`;
  const delRes = await fetch(guildUrl, {
    method: "PUT",
    headers: { Authorization: `Bot ${BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify([]), // empty array = delete all guild commands
  });
  if (delRes.ok) console.log(`🗑️  Guild commands cleared (no more duplicates)`);
}

console.log("\nℹ️  Global commands se propagan en hasta 1 hora.");
console.log("   En DMs con el bot ya deberían funcionar antes.");
