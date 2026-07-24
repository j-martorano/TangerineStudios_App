import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ClientForInvoice, InvoiceSettings, InvoiceWithProjects } from "./types";
import { CACHE_TAGS } from "@/lib/cache-tags";

// ── Facturas ──────────────────────────────────────────────────────────────────

export const fetchInvoices = unstable_cache(
  async (): Promise<InvoiceWithProjects[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("invoices")
      .select(
        `id, invoice_number, invoice_code, date,
         client_id, client_name, client_address, client_country,
         currency_symbol, items, subtotal,
         discount_enabled, discount_type, discount_value, discount_amount,
         upfront_enabled, upfront_percentage, upfront_amount,
         total, notes, pdf_storage_path, created_at,
         invoice_projects(project_id, project:projects(id, title, project_code))`
      )
      .order("invoice_number", { ascending: false });

    if (error) throw new Error(error.message);

    return ((data ?? []) as unknown[]).map((raw: unknown) => {
      const r = raw as Record<string, unknown>;
      const links = (r.invoice_projects as { project: unknown }[] | null) ?? [];
      const projects = links
        .map((l) => l.project)
        .filter((p): p is { id: string; title: string; project_code: string | null } =>
          p != null
        );
      const { invoice_projects: _ignored, ...rest } = r;
      return { ...(rest as object), items: r.items ?? [], projects } as InvoiceWithProjects;
    });
  },
  ["invoices"],
  { tags: [CACHE_TAGS.invoices] }
);

// ── Clientes para facturas ────────────────────────────────────────────────────

export const fetchClientsForInvoice = unstable_cache(
  async (): Promise<ClientForInvoice[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, billing_name, tax_id, address, city, state, country, payment_type, agreed_price, retainer_discount_pct")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as ClientForInvoice[];
  },
  ["clients-for-invoice"],
  { tags: [CACHE_TAGS.clients] }
);

// ── Configuración de facturación ──────────────────────────────────────────────

export const fetchInvoiceSettings = unstable_cache(
  async (): Promise<InvoiceSettings> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("invoice_settings")
      .select(
        "next_number, sender_name, sender_address, sender_city, sender_state, sender_country, sender_email"
      )
      .eq("id", 1)
      .single();

    if (error) {
      return {
        next_number: 1,
        sender_name: "Joaquín Martorano Perozzi",
        sender_address: "",
        sender_city: "1876 Quilmes Oeste",
        sender_state: "Buenos Aires",
        sender_country: "Argentina",
        sender_email: "yoakodesign@gmail.com",
      };
    }

    return data as InvoiceSettings;
  },
  ["invoice-settings"],
  { tags: [CACHE_TAGS.invoices, CACHE_TAGS.settings] }
);
