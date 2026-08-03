"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import React from "react";
import { InvoicePDF } from "./pdf";
import { fetchInvoiceSettings } from "./queries";
import type { InvoiceInput, InvoiceSettings } from "./types";

type ActionResult = { ok: true; invoiceId?: string } | { ok: false; error: string };

// ── Validación ────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  name: z.string().trim().min(1, "El nombre del ítem es obligatorio"),
  description: z.string().default(""),
  quantity: z.number().nonnegative(),
  rate: z.number().nonnegative(),
});

const invoiceInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  currency_symbol: z.string().min(1),
  client_name: z.string().trim().min(1, "El nombre del cliente es obligatorio"),
  client_address: z.string().default(""),
  client_country: z.string().default(""),
  client_id: z.string().nullable(),
  items: z.array(itemSchema).min(1, "Debe tener al menos un ítem"),
  discount: z.object({
    enabled: z.boolean(),
    type: z.enum(["percentage", "fixed"]),
    value: z.number().nonnegative(),
  }),
  upfront: z.object({
    enabled: z.boolean(),
    percentage: z.number().min(0).max(100),
  }),
  notes: z.string().default(""),
  project_ids: z.array(z.string()).default([]),
});

// ── Crear factura ─────────────────────────────────────────────────────────────

export async function createInvoice(input: InvoiceInput): Promise<ActionResult> {
  const parsed = invoiceInputSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return { ok: false, error: msg };
  }

  const d = parsed.data;
  const supabase = await createClient();

  // 1. Reclamar número atómico
  const { data: numData, error: numErr } = await supabase.rpc(
    "claim_invoice_number"
  );
  if (numErr || numData == null) {
    return { ok: false, error: numErr?.message ?? "No se pudo reservar número de factura" };
  }
  const invoiceNumber: number = numData;
  const clientCode = (d.client_name.split(/\s+/)[0] ?? "CLIENT")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8) || "CLIENT";
  const invoiceCode = `${clientCode}-INV${String(invoiceNumber).padStart(5, "0")}`;

  // 2. Calcular totales
  const subtotal = d.items.reduce((s, it) => s + it.quantity * it.rate, 0);
  let discountAmount = 0;
  if (d.discount.enabled && d.discount.value > 0) {
    discountAmount =
      d.discount.type === "percentage"
        ? subtotal * (d.discount.value / 100)
        : d.discount.value;
  }
  const afterDiscount = subtotal - discountAmount;
  let upfrontAmount = 0;
  if (d.upfront.enabled && d.upfront.percentage > 0) {
    upfrontAmount = afterDiscount * (d.upfront.percentage / 100);
  }
  const total = afterDiscount - upfrontAmount;

  // 3. Obtener configuración del emisor para el PDF
  const settings = await fetchInvoiceSettings();

  // 4. Generar PDF
  let pdfStoragePath: string | null = null;
  try {
    const pdfBuffer = await renderToBuffer(
      React.createElement(InvoicePDF, {
        id: invoiceCode,
        date: d.date,
        clientName: d.client_name,
        clientAddress: d.client_address,
        clientCountry: d.client_country,
        items: d.items,
        currencySymbol: d.currency_symbol,
        subtotal,
        discountEnabled: d.discount.enabled,
        discountType: d.discount.type,
        discountValue: d.discount.value,
        discountAmount,
        upfrontEnabled: d.upfront.enabled,
        upfrontPercentage: d.upfront.percentage,
        upfrontAmount,
        total,
        notes: d.notes || null,
        settings,
      }) as React.ReactElement<DocumentProps>
    );

    const filename = `${invoiceCode}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("invoices")
      .upload(filename, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      // DEBUG: surface storage errors
      return { ok: false, error: `[Storage] ${uploadErr.message}` };
    } else {
      pdfStoragePath = filename;
    }
  } catch (pdfErr) {
    // DEBUG: surface PDF generation errors
    return { ok: false, error: `[PDF] ${String(pdfErr)}` };
  }

  // 5. Insertar factura
  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      invoice_code: invoiceCode,
      date: d.date,
      client_id: d.client_id,
      client_name: d.client_name,
      client_address: d.client_address,
      client_country: d.client_country,
      currency_symbol: d.currency_symbol,
      items: d.items as unknown as import("@/lib/database.types").Json,
      subtotal,
      discount_enabled: d.discount.enabled,
      discount_type: d.discount.type,
      discount_value: d.discount.value,
      discount_amount: discountAmount,
      upfront_enabled: d.upfront.enabled,
      upfront_percentage: d.upfront.percentage,
      upfront_amount: upfrontAmount,
      total,
      notes: d.notes || null,
      pdf_storage_path: pdfStoragePath,
    })
    .select("id")
    .single();

  if (invErr || !inv) {
    return { ok: false, error: invErr?.message ?? "Error al guardar la factura" };
  }

  // 6. Vincular proyectos y marcarlos como facturados
  if (d.project_ids.length > 0) {
    const links = d.project_ids.map((pid) => ({
      invoice_id: inv.id,
      project_id: pid,
    }));
    const { error: linkErr } = await supabase
      .from("invoice_projects")
      .insert(links);
    if (linkErr) console.error("Error linking projects:", linkErr.message);

    // Marcar cada proyecto vinculado como facturado
    await supabase
      .from("projects")
      .update({ invoiced: "si" })
      .in("id", d.project_ids);
  }

  revalidateTag(CACHE_TAGS.invoices, {});
  revalidateTag(CACHE_TAGS.projects, {});
  revalidatePath("/facturas");
  revalidatePath("/kanban");
  revalidatePath("/projects");
  return { ok: true, invoiceId: inv.id };
}

// ── Eliminar factura ──────────────────────────────────────────────────────────

export async function deleteInvoice(id: string): Promise<ActionResult> {
  const supabase = await createClient();

  // Obtener el path del PDF para borrarlo del storage
  const { data: inv } = await supabase
    .from("invoices")
    .select("pdf_storage_path")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Intentar borrar el PDF del storage (no fatal si falla)
  if (inv?.pdf_storage_path) {
    await supabase.storage.from("invoices").remove([inv.pdf_storage_path]);
  }

  revalidateTag(CACHE_TAGS.invoices, {});
  revalidatePath("/facturas");
  return { ok: true };
}

// ── URL firmada del PDF ───────────────────────────────────────────────────────

export async function getInvoicePdfUrl(
  storagePath: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("invoices")
    .createSignedUrl(storagePath, 60 * 60); // 1 hora

  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? "No se pudo generar la URL" };
  }
  return { ok: true, url: data.signedUrl };
}

// ── Actualizar configuración ──────────────────────────────────────────────────

const settingsSchema = z.object({
  next_number: z.number().int().positive(),
  sender_name: z.string().trim().min(1),
  sender_address: z.string().default(""),
  sender_city: z.string().default(""),
  sender_state: z.string().default(""),
  sender_country: z.string().default(""),
  sender_email: z.string().default(""),
});

export async function updateInvoiceSettings(
  input: InvoiceSettings
): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("invoice_settings")
    .update(parsed.data)
    .eq("id", 1);

  if (error) return { ok: false, error: error.message };
  revalidateTag(CACHE_TAGS.invoices, {});
  revalidateTag(CACHE_TAGS.settings, {});
  revalidatePath("/configuracion");
  revalidatePath("/facturas");
  return { ok: true };
}

// ── Regenerar PDF de una factura existente ────────────────────────────────────

export async function regenerateInvoicePdf(
  invoiceId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: inv, error: fetchErr } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (fetchErr || !inv) {
    return { ok: false, error: fetchErr?.message ?? "Factura no encontrada" };
  }

  const settings = await fetchInvoiceSettings();

  try {
    const pdfBuffer = await renderToBuffer(
      React.createElement(InvoicePDF, {
        id: inv.invoice_code,
        date: inv.date,
        clientName: inv.client_name,
        clientAddress: inv.client_address ?? "",
        clientCountry: inv.client_country ?? "",
        items: (inv.items ?? []) as import("./types").InvoiceItem[],
        currencySymbol: inv.currency_symbol,
        subtotal: inv.subtotal,
        discountEnabled: inv.discount_enabled,
        discountType: inv.discount_type as "percentage" | "fixed",
        discountValue: inv.discount_value,
        discountAmount: inv.discount_amount,
        upfrontEnabled: inv.upfront_enabled,
        upfrontPercentage: inv.upfront_percentage,
        upfrontAmount: inv.upfront_amount,
        total: inv.total,
        notes: inv.notes ?? null,
        settings,
      }) as React.ReactElement<DocumentProps>
    );

    const filename = `${inv.invoice_code}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("invoices")
      .upload(filename, pdfBuffer, { contentType: "application/pdf", upsert: true });

    if (uploadErr) return { ok: false, error: uploadErr.message };

    await supabase
      .from("invoices")
      .update({ pdf_storage_path: filename })
      .eq("id", invoiceId);
  } catch (err) {
    return { ok: false, error: String(err) };
  }

  revalidatePath("/facturas");
  return { ok: true };
}
