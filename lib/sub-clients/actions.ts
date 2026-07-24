"use server";

import { createClient } from "@/lib/supabase/server";

export type SubClientItem = { id: string; name: string };

/** Devuelve los sub-clientes de un cliente, ordenados por nombre. */
export async function getSubClientsForClient(clientId: string): Promise<SubClientItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sub_clients")
    .select("id, name")
    .eq("client_id", clientId)
    .order("name");
  return (data ?? []) as SubClientItem[];
}

/**
 * Asegura que todos los nombres de la lista existan en la tabla sub_clients
 * para el cliente dado. Ignora duplicados (upsert por unique(client_id, name)).
 */
export async function upsertSubClients(
  clientId: string,
  names: string[]
): Promise<void> {
  const unique = Array.from(new Set(names.filter(Boolean)));
  if (unique.length === 0) return;
  const supabase = await createClient();
  await supabase
    .from("sub_clients")
    .upsert(
      unique.map((name) => ({ client_id: clientId, name })),
      { onConflict: "client_id,name", ignoreDuplicates: true }
    );
}
