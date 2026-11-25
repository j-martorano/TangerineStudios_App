import { unstable_cache } from "next/cache";

import { CACHE_TAGS } from "@/lib/cache-tags";
import { createBotClient } from "@/lib/supabase/bot";
import {
  isOutreachStatus,
  isResourceKind,
  type OutreachConfig,
  type OutreachMessage,
  type OutreachPlatform,
  type OutreachResource,
  type OutreachTemplate,
  type ResourceSnapshot,
} from "./types";

/**
 * Lecturas de Outreach. Service role dentro de unstable_cache (como el resto
 * de la app); el guard de la página (requireTab("outreach")) va antes.
 */

function parseSnapshots(raw: unknown): ResourceSnapshot[] {
  if (!Array.isArray(raw)) return [];
  const out: ResourceSnapshot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.kind !== "string" || !isResourceKind(r.kind)) continue;
    if (typeof r.name !== "string" || typeof r.url !== "string") continue;
    out.push({
      kind: r.kind,
      name: r.name,
      url: r.url,
      iconUrl: typeof r.iconUrl === "string" ? r.iconUrl : null,
    });
  }
  return out;
}

export const fetchOutreachConfig = unstable_cache(
  async (): Promise<OutreachConfig> => {
    const sb = createBotClient();
    const [templatesRes, platformsRes, resourcesRes, settingsRes] = await Promise.all([
      sb.from("outreach_templates").select("id, name, body, sort_order").order("sort_order").order("name"),
      sb
        .from("outreach_platforms")
        .select("id, name, icon, icon_url, color, template_id, sort_order")
        .order("sort_order")
        .order("name"),
      sb
        .from("outreach_resources")
        .select("id, kind, name, url, tag, icon_url, description, sort_order")
        .order("sort_order")
        .order("name"),
      sb.from("outreach_settings").select("default_template_id, ai_prompt, ai_model").eq("id", 1).maybeSingle(),
    ]);
    if (templatesRes.error) throw new Error(templatesRes.error.message);
    if (platformsRes.error) throw new Error(platformsRes.error.message);
    if (resourcesRes.error) throw new Error(resourcesRes.error.message);
    if (settingsRes.error) throw new Error(settingsRes.error.message);

    const templates: OutreachTemplate[] = (templatesRes.data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      body: t.body,
      sortOrder: t.sort_order,
    }));
    const platforms: OutreachPlatform[] = (platformsRes.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      icon: p.icon,
      iconUrl: p.icon_url,
      color: p.color,
      templateId: p.template_id,
      sortOrder: p.sort_order,
    }));
    const resources: OutreachResource[] = (resourcesRes.data ?? []).flatMap((r) =>
      isResourceKind(r.kind)
        ? [
            {
              id: r.id,
              kind: r.kind,
              name: r.name,
              url: r.url,
              tag: r.tag,
              iconUrl: r.icon_url,
              description: r.description,
              sortOrder: r.sort_order,
            },
          ]
        : []
    );
    return {
      templates,
      defaultTemplateId: settingsRes.data?.default_template_id ?? null,
      platforms,
      resources,
      aiPrompt: settingsRes.data?.ai_prompt ?? null,
      aiModel: settingsRes.data?.ai_model ?? null,
    };
  },
  ["outreach-config"],
  { tags: [CACHE_TAGS.outreach] }
);

/** Todos los mensajes registrados, del más reciente al más viejo. */
export const fetchOutreachMessages = unstable_cache(
  async (): Promise<OutreachMessage[]> => {
    const sb = createBotClient();
    const { data, error } = await sb
      .from("outreach_messages")
      .select(
        "id, client_name, platform_id, platform_name, message, post_url, status, notes, resources, sent_at, created_at"
      )
      .order("sent_at", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((m) => ({
      id: m.id,
      clientName: m.client_name,
      platformId: m.platform_id,
      platformName: m.platform_name,
      message: m.message,
      postUrl: m.post_url,
      status: isOutreachStatus(m.status) ? m.status : "enviado",
      notes: m.notes,
      resources: parseSnapshots(m.resources),
      sentAt: m.sent_at,
      createdAt: m.created_at,
    }));
  },
  ["outreach-messages"],
  { tags: [CACHE_TAGS.outreach] }
);
