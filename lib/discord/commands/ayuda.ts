import type { DiscordInteraction } from "../types";
import { reply } from "../respond";

export async function handleAyuda(
  _interaction: DiscordInteraction
): Promise<Response> {
  return reply(
    [
      "**Comandos disponibles:**",
      "",
      "`/vincular [código]` — Vinculá tu cuenta de Discord con la app",
      "`/proyectos` — Listá tus proyectos activos",
      "`/estado [proyecto]` — Ver el estado de un proyecto",
      "`/mover [proyecto] [fase]` — Mover un proyecto a otra fase",
      "`/ayuda` — Mostrar este mensaje",
    ].join("\n")
  );
}
