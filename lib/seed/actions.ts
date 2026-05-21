"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Sólo este usuario ve y puede tocar el seed. Si el día de mañana hay que
// agregar otro, hacelo acá. Server-side: las acciones también validan.
const SEED_OWNER_EMAIL = "erikpastuszek@gmail.com";

export async function isSeedOwner(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email === SEED_OWNER_EMAIL;
}

// =========================================================================
// Datos de prueba — seed activable / desactivable.
//
// Todos los IDs arrancan con `dddddddd-` para identificarlos a la hora de
// borrar. Los nombres también van prefijados con [SEED] así se distinguen
// visualmente de la data real.
//
// Estructura:
//   3 editores (uno por cada modelo de pago: por_minuto / flat / flat_variable)
//   5 clientes (FLAT / Por minuto / RETAINER × 2 / Por minuto)
//   pares cliente-editor con configs custom (algunos con override, otros
//      heredando el global del editor)
//   15 proyectos repartidos en 3 meses (marzo, abril, mayo 2026)
//   1 proyecto de marzo aún no finalizado (para probar el auto-carry del kanban)
//   pagos de clientes mensuales (con minutos acreditados)
//   servicios fijos mensuales
//   métodos de pago de editores
// =========================================================================

const ED1 = "dddddddd-0000-0000-0000-000000000001"; // Kopi
const ED2 = "dddddddd-0000-0000-0000-000000000002"; // Diego
const ED3 = "dddddddd-0000-0000-0000-000000000003"; // Mariana

const CL1 = "dddddddd-0000-0000-0000-000000000011"; // Acme
const CL2 = "dddddddd-0000-0000-0000-000000000012"; // Naranja
const CL3 = "dddddddd-0000-0000-0000-000000000013"; // El Chino
const CL4 = "dddddddd-0000-0000-0000-000000000014"; // Policing Uncut
const CL5 = "dddddddd-0000-0000-0000-000000000015"; // DJ's Thoughts

const PJ = (n: number): string =>
  `dddddddd-0000-0000-0000-${(0x100 + n).toString(16).padStart(12, "0")}`;
const PM = (n: number): string =>
  `dddddddd-0000-0000-0000-${(0x200 + n).toString(16).padStart(12, "0")}`;
const FS = (n: number): string =>
  `dddddddd-0000-0000-0000-${(0x300 + n).toString(16).padStart(12, "0")}`;
const CP = (n: number): string =>
  `dddddddd-0000-0000-0000-${(0x400 + n).toString(16).padStart(12, "0")}`;

const ALL_EDITORS = [ED1, ED2, ED3];
const ALL_CLIENTS = [CL1, CL2, CL3, CL4, CL5];
const ALL_PROJECTS = Array.from({ length: 15 }, (_, i) => PJ(i + 1));
const ALL_METHODS = [PM(1), PM(2), PM(3), PM(4)];
const ALL_SERVICES = [FS(1), FS(2), FS(3)];
const ALL_PAYMENTS = [CP(1), CP(2), CP(3)];

export type SeedResult = { ok: true } | { ok: false; error: string };

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function isSeedActive(): Promise<boolean> {
  if (!(await isSeedOwner())) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("editors")
    .select("id")
    .in("id", ALL_EDITORS)
    .limit(1);
  return (data ?? []).length > 0;
}

export async function activateSeed(): Promise<SeedResult> {
  if (!(await isSeedOwner())) {
    return { ok: false, error: "No autorizado" };
  }
  const supabase = await createClient();

  // ---- Editores ----
  const editorsInsert = await supabase.from("editors").upsert(
    [
      {
        id: ED1,
        name: "[SEED] Kopi",
        payment_type: "por_minuto" as const,
        rate: 17,
        discord_id: "seed-kopi",
      },
      {
        id: ED2,
        name: "[SEED] Diego",
        payment_type: "flat" as const,
        flat_amount: 70,
        discord_id: "seed-diego",
      },
      {
        id: ED3,
        name: "[SEED] Mariana",
        payment_type: "flat_variable" as const,
        discord_id: "seed-mariana",
      },
    ],
    { onConflict: "id" }
  );
  if (editorsInsert.error)
    return { ok: false, error: `editors: ${editorsInsert.error.message}` };

  // ---- Tramos globales de Mariana ----
  await supabase.from("editor_payment_tiers").delete().eq("editor_id", ED3);
  const mtierIns = await supabase.from("editor_payment_tiers").insert([
    { editor_id: ED3, min_minutes: 10, max_minutes: 15, amount: 90 },
    { editor_id: ED3, min_minutes: 15, max_minutes: 25, amount: 140 },
    { editor_id: ED3, min_minutes: 25, max_minutes: 35, amount: 210 },
  ]);
  if (mtierIns.error)
    return {
      ok: false,
      error: `editor_payment_tiers: ${mtierIns.error.message}`,
    };

  // ---- Clientes ----
  // Importante: supabase-js unifica las keys de los rows que pasamos al
  // upsert; los rows que no incluyen una key terminan mandando NULL en el
  // SQL. Por eso tenemos que pasar agreed_price y retainer_discount_pct
  // SIEMPRE (retainer_discount_pct es NOT NULL).
  const clientsIns = await supabase.from("clients").upsert(
    [
      {
        id: CL1,
        name: "[SEED] Acme Studios",
        color: "#ff6b35",
        payment_type: "por_proyecto" as const,
        agreed_price: null,
        retainer_discount_pct: 10,
      },
      {
        id: CL2,
        name: "[SEED] Naranja Films",
        color: "#f7b801",
        payment_type: "por_rate" as const,
        agreed_price: 20,
        retainer_discount_pct: 10,
      },
      {
        id: CL3,
        name: "[SEED] El Chino",
        color: "#c1272d",
        payment_type: "mensual" as const,
        agreed_price: 15,
        retainer_discount_pct: 10,
      },
      {
        id: CL4,
        name: "[SEED] Policing Uncut",
        color: "#1d3557",
        payment_type: "por_rate" as const,
        agreed_price: 25,
        retainer_discount_pct: 10,
      },
      {
        id: CL5,
        name: "[SEED] DJ's Thoughts",
        color: "#2a9d8f",
        payment_type: "mensual" as const,
        agreed_price: 18,
        retainer_discount_pct: 10,
      },
    ],
    { onConflict: "id" }
  );
  if (clientsIns.error)
    return { ok: false, error: `clients: ${clientsIns.error.message}` };

  // ---- client_editors (pares con config) ----
  // Limpiamos los pares previos de estos editores para mantener idempotencia.
  await supabase.from("client_editors").delete().in("editor_id", ALL_EDITORS);
  const pairsIns = await supabase.from("client_editors").insert([
    // Kopi (por_minuto) — distintos rates según cliente
    {
      client_id: CL3,
      editor_id: ED1,
      payment_type: "por_minuto" as const,
      rate: 17,
    },
    {
      client_id: CL4,
      editor_id: ED1,
      payment_type: "por_minuto" as const,
      rate: 20,
    },
    {
      client_id: CL5,
      editor_id: ED1,
      payment_type: "por_minuto" as const,
      rate: 15,
    },
    // Diego (flat) — Acme default, Naranja distinto, Chino hereda global
    {
      client_id: CL1,
      editor_id: ED2,
      payment_type: "flat" as const,
      flat_amount: 70,
    },
    {
      client_id: CL2,
      editor_id: ED2,
      payment_type: "flat" as const,
      flat_amount: 80,
    },
    { client_id: CL3, editor_id: ED2, payment_type: null },
    // Mariana (flat_variable) — Policing custom, Acme hereda global
    {
      client_id: CL4,
      editor_id: ED3,
      payment_type: "flat_variable" as const,
    },
    { client_id: CL1, editor_id: ED3, payment_type: null },
  ]);
  if (pairsIns.error)
    return { ok: false, error: `client_editors: ${pairsIns.error.message}` };

  // ---- Tramos custom de Mariana × Policing ----
  const pairTiersIns = await supabase
    .from("client_editor_payment_tiers")
    .insert([
      {
        client_id: CL4,
        editor_id: ED3,
        min_minutes: 10,
        max_minutes: 15,
        amount: 100,
      },
      {
        client_id: CL4,
        editor_id: ED3,
        min_minutes: 15,
        max_minutes: 25,
        amount: 160,
      },
      {
        client_id: CL4,
        editor_id: ED3,
        min_minutes: 25,
        max_minutes: 35,
        amount: 240,
      },
    ]);
  if (pairTiersIns.error)
    return {
      ok: false,
      error: `client_editor_payment_tiers: ${pairTiersIns.error.message}`,
    };

  // ---- Proyectos ----
  // Importante: supabase-js unifica las keys, así que pasamos siempre todos
  // los campos con null donde corresponda (sobre todo invoiced que es NOT
  // NULL y client_name por las dudas).
  type SeedProject = {
    id: string;
    title: string;
    client_id: string;
    client_name: string;
    phase: "por_asignar" | "editando" | "terminado";
    finalized: boolean;
    finalized_at: string | null;
    price: number | null;
    duration_minutes: number | null;
    cobrado: "no" | "parcial" | "si";
    pagado: "sin_pagar" | "parcial" | "pago_total";
    invoiced: "no" | "parcial" | "si";
    created_at: string;
  };
  const projects: SeedProject[] = [
    // Marzo 2026
    {
      id: PJ(1),
      title: "[SEED] Reel demo Acme",
      client_id: CL1,
      client_name: "[SEED] Acme Studios",
      phase: "terminado",
      finalized: true,
      finalized_at: "2026-03-25T12:00:00Z",
      price: 450,
      duration_minutes: 90,
      cobrado: "si",
      pagado: "pago_total",
      invoiced: "si",
      created_at: "2026-03-05T12:00:00Z",
    },
    {
      id: PJ(2),
      title: "[SEED] Spot Naranja otoño",
      client_id: CL2,
      client_name: "[SEED] Naranja Films",
      phase: "terminado",
      finalized: true,
      finalized_at: "2026-03-28T12:00:00Z",
      price: null,
      duration_minutes: 30,
      cobrado: "si",
      pagado: "pago_total",
      invoiced: "si",
      created_at: "2026-03-10T12:00:00Z",
    },
    {
      id: PJ(3),
      title: "[SEED] Podcast Chino ep.1",
      client_id: CL3,
      client_name: "[SEED] El Chino",
      phase: "terminado",
      finalized: true,
      finalized_at: "2026-03-25T12:00:00Z",
      price: null,
      duration_minutes: 45,
      cobrado: "si",
      pagado: "pago_total",
      invoiced: "si",
      created_at: "2026-03-12T12:00:00Z",
    },
    {
      id: PJ(4),
      title: "[SEED] Reel Policing #1",
      client_id: CL4,
      client_name: "[SEED] Policing Uncut",
      phase: "terminado",
      finalized: true,
      finalized_at: "2026-03-30T12:00:00Z",
      price: null,
      duration_minutes: 18,
      cobrado: "parcial",
      pagado: "parcial",
      invoiced: "parcial",
      created_at: "2026-03-15T12:00:00Z",
    },
    {
      id: PJ(5),
      title: "[SEED] Acme video pendiente (auto-carry)",
      client_id: CL1,
      client_name: "[SEED] Acme Studios",
      phase: "editando",
      finalized: false,
      finalized_at: null,
      price: 300,
      duration_minutes: 60,
      cobrado: "no",
      pagado: "sin_pagar",
      invoiced: "no",
      created_at: "2026-03-22T12:00:00Z",
    },
    // Abril 2026
    {
      id: PJ(6),
      title: "[SEED] DJ's Thoughts ep.5",
      client_id: CL5,
      client_name: "[SEED] DJ's Thoughts",
      phase: "terminado",
      finalized: true,
      finalized_at: "2026-04-15T12:00:00Z",
      price: null,
      duration_minutes: 22,
      cobrado: "si",
      pagado: "pago_total",
      invoiced: "si",
      created_at: "2026-04-03T12:00:00Z",
    },
    {
      id: PJ(7),
      title: "[SEED] Naranja spring spot",
      client_id: CL2,
      client_name: "[SEED] Naranja Films",
      phase: "terminado",
      finalized: true,
      finalized_at: "2026-04-22T12:00:00Z",
      price: null,
      duration_minutes: 25,
      cobrado: "parcial",
      pagado: "sin_pagar",
      invoiced: "parcial",
      created_at: "2026-04-08T12:00:00Z",
    },
    {
      id: PJ(8),
      title: "[SEED] Acme corporativo Q2",
      client_id: CL1,
      client_name: "[SEED] Acme Studios",
      phase: "editando",
      finalized: false,
      finalized_at: null,
      price: 600,
      duration_minutes: 50,
      cobrado: "no",
      pagado: "sin_pagar",
      invoiced: "no",
      created_at: "2026-04-12T12:00:00Z",
    },
    {
      id: PJ(9),
      title: "[SEED] Policing Uncut #3",
      client_id: CL4,
      client_name: "[SEED] Policing Uncut",
      phase: "editando",
      finalized: false,
      finalized_at: null,
      price: null,
      duration_minutes: 20,
      cobrado: "no",
      pagado: "sin_pagar",
      invoiced: "no",
      created_at: "2026-04-18T12:00:00Z",
    },
    {
      id: PJ(10),
      title: "[SEED] Reel highlights Chino",
      client_id: CL3,
      client_name: "[SEED] El Chino",
      phase: "terminado",
      finalized: true,
      finalized_at: "2026-04-30T12:00:00Z",
      price: null,
      duration_minutes: 12,
      cobrado: "si",
      pagado: "pago_total",
      invoiced: "si",
      created_at: "2026-04-25T12:00:00Z",
    },
    // Mayo 2026
    {
      id: PJ(11),
      title: "[SEED] Acme casamiento P/G",
      client_id: CL1,
      client_name: "[SEED] Acme Studios",
      phase: "editando",
      finalized: false,
      finalized_at: null,
      price: 800,
      duration_minutes: 40,
      cobrado: "no",
      pagado: "sin_pagar",
      invoiced: "no",
      created_at: "2026-05-02T12:00:00Z",
    },
    {
      id: PJ(12),
      title: "[SEED] DJ's Thoughts ep.6",
      client_id: CL5,
      client_name: "[SEED] DJ's Thoughts",
      phase: "editando",
      finalized: false,
      finalized_at: null,
      price: null,
      duration_minutes: 0,
      cobrado: "no",
      pagado: "sin_pagar",
      invoiced: "no",
      created_at: "2026-05-05T12:00:00Z",
    },
    {
      id: PJ(13),
      title: "[SEED] Policing Uncut #4",
      client_id: CL4,
      client_name: "[SEED] Policing Uncut",
      phase: "terminado",
      finalized: true,
      finalized_at: "2026-05-18T12:00:00Z",
      price: null,
      duration_minutes: 28,
      cobrado: "si",
      pagado: "pago_total",
      invoiced: "si",
      created_at: "2026-05-10T12:00:00Z",
    },
    {
      id: PJ(14),
      title: "[SEED] Naranja teaser verano",
      client_id: CL2,
      client_name: "[SEED] Naranja Films",
      phase: "por_asignar",
      finalized: false,
      finalized_at: null,
      price: null,
      duration_minutes: null,
      cobrado: "no",
      pagado: "sin_pagar",
      invoiced: "no",
      created_at: "2026-05-12T12:00:00Z",
    },
    {
      id: PJ(15),
      title: "[SEED] Chino recap semanal",
      client_id: CL3,
      client_name: "[SEED] El Chino",
      phase: "editando",
      finalized: false,
      finalized_at: null,
      price: null,
      duration_minutes: 8,
      cobrado: "no",
      pagado: "sin_pagar",
      invoiced: "no",
      created_at: "2026-05-18T12:00:00Z",
    },
  ];

  // El trigger projects_set_code_trg llena project_code automáticamente. Pero
  // si los rows ya existían, el code ya está; el upsert respeta lo guardado.
  const projectsIns = await supabase
    .from("projects")
    .upsert(projects as never, { onConflict: "id" });
  if (projectsIns.error)
    return { ok: false, error: `projects: ${projectsIns.error.message}` };

  // ---- project_editors ----
  await supabase
    .from("project_editors")
    .delete()
    .in("project_id", ALL_PROJECTS);
  const projectEditors = [
    { project_id: PJ(1), editor_id: ED2, cost: null }, // Diego flat Acme = $70
    { project_id: PJ(2), editor_id: ED1, cost: null }, // Kopi Naranja sin pair → global por_minuto $17
    { project_id: PJ(2), editor_id: ED2, cost: null }, // Diego Naranja $80
    { project_id: PJ(3), editor_id: ED1, cost: null }, // Kopi Chino $17 × 45 = $765
    { project_id: PJ(4), editor_id: ED3, cost: null }, // Mariana Policing tier 18min = $160
    { project_id: PJ(5), editor_id: ED2, cost: null }, // Diego Acme = $70
    { project_id: PJ(6), editor_id: ED1, cost: null }, // Kopi DJs $15 × 22 = $330
    { project_id: PJ(7), editor_id: ED1, cost: null }, // Kopi Naranja (sin pair → global $17 × 25)
    { project_id: PJ(7), editor_id: ED2, cost: null }, // Diego Naranja $80
    { project_id: PJ(8), editor_id: ED2, cost: 90 }, // Diego Acme override manual = $90
    { project_id: PJ(9), editor_id: ED3, cost: null }, // Mariana Policing tier 20min = $160
    { project_id: PJ(10), editor_id: ED1, cost: null }, // Kopi Chino $17 × 12 = $204
    { project_id: PJ(11), editor_id: ED2, cost: null }, // Diego Acme = $70
    { project_id: PJ(12), editor_id: ED1, cost: null }, // Kopi DJs
    { project_id: PJ(13), editor_id: ED3, cost: null }, // Mariana Policing tier 28min = $240
    { project_id: PJ(14), editor_id: ED1, cost: null }, // Kopi Naranja
    { project_id: PJ(15), editor_id: ED1, cost: null }, // Kopi Chino $17 × 8 = $136
    { project_id: PJ(15), editor_id: ED2, cost: null }, // Diego Chino → global flat $70
  ];
  const peIns = await supabase
    .from("project_editors")
    .insert(projectEditors);
  if (peIns.error)
    return { ok: false, error: `project_editors: ${peIns.error.message}` };

  // ---- Pagos de clientes mensuales ----
  await supabase.from("client_payments").delete().in("id", ALL_PAYMENTS);
  const chinoEff = 15 * 0.9; // 13.5
  const djsEff = 18 * 0.9; // 16.2
  const payIns = await supabase.from("client_payments").upsert(
    [
      {
        id: CP(1),
        client_id: CL3,
        amount: 1500,
        minutes_credited: Number((1500 / chinoEff).toFixed(2)),
        paid_at: "2026-03-05",
        note: "[SEED] Pago marzo",
      },
      {
        id: CP(2),
        client_id: CL3,
        amount: 1200,
        minutes_credited: Number((1200 / chinoEff).toFixed(2)),
        paid_at: "2026-04-05",
        note: "[SEED] Pago abril",
      },
      {
        id: CP(3),
        client_id: CL5,
        amount: 800,
        minutes_credited: Number((800 / djsEff).toFixed(2)),
        paid_at: "2026-04-10",
        note: "[SEED] Primer pago DJs",
      },
    ],
    { onConflict: "id" }
  );
  if (payIns.error)
    return { ok: false, error: `client_payments: ${payIns.error.message}` };

  // ---- Servicios fijos ----
  const fsIns = await supabase.from("fixed_services").upsert(
    [
      {
        id: FS(1),
        name: "[SEED] Adobe Creative Cloud",
        monthly_cost: 59.99,
        active: true,
      },
      {
        id: FS(2),
        name: "[SEED] Dominio + hosting",
        monthly_cost: 12,
        active: true,
      },
      {
        id: FS(3),
        name: "[SEED] Storage cloud",
        monthly_cost: 20,
        active: true,
      },
    ],
    { onConflict: "id" }
  );
  if (fsIns.error)
    return { ok: false, error: `fixed_services: ${fsIns.error.message}` };

  // ---- Catálogo de métodos de pago ----
  const pmIns = await supabase.from("payment_methods").upsert(
    [
      { id: PM(1), name: "[SEED] Binance" },
      { id: PM(2), name: "[SEED] DolarApp" },
      { id: PM(3), name: "[SEED] Banco BBVA" },
      { id: PM(4), name: "[SEED] PayPal" },
    ],
    { onConflict: "id" }
  );
  if (pmIns.error)
    return { ok: false, error: `payment_methods: ${pmIns.error.message}` };

  // ---- Métodos por editor ----
  await supabase
    .from("editor_payment_methods")
    .delete()
    .in("editor_id", ALL_EDITORS);
  const epmIns = await supabase.from("editor_payment_methods").insert([
    {
      editor_id: ED1,
      method_id: PM(1),
      info: "Binance ID: 12345678",
    },
    {
      editor_id: ED1,
      method_id: PM(2),
      info: "user @kopi",
    },
    {
      editor_id: ED2,
      method_id: PM(3),
      info: "CBU 0123456789012345678901 — Diego Martínez",
    },
    {
      editor_id: ED3,
      method_id: PM(4),
      info: "mariana.editor@example.com",
    },
  ]);
  if (epmIns.error)
    return {
      ok: false,
      error: `editor_payment_methods: ${epmIns.error.message}`,
    };

  revalidateAll();
  return { ok: true };
}

export async function deactivateSeed(): Promise<SeedResult> {
  if (!(await isSeedOwner())) {
    return { ok: false, error: "No autorizado" };
  }
  const supabase = await createClient();

  // Borramos en orden seguro. Las pivots con FK on-delete-cascade desaparecen
  // solas cuando se borra el editor/cliente/proyecto padre.
  const deletions = [
    supabase.from("project_editors").delete().in("project_id", ALL_PROJECTS),
    supabase.from("projects").delete().in("id", ALL_PROJECTS),
    supabase.from("client_payments").delete().in("id", ALL_PAYMENTS),
    supabase
      .from("client_editor_payment_tiers")
      .delete()
      .in("editor_id", ALL_EDITORS),
    supabase.from("client_editors").delete().in("editor_id", ALL_EDITORS),
    supabase.from("editor_payment_tiers").delete().in("editor_id", ALL_EDITORS),
    supabase
      .from("editor_payment_methods")
      .delete()
      .in("editor_id", ALL_EDITORS),
    supabase.from("editors").delete().in("id", ALL_EDITORS),
    supabase.from("clients").delete().in("id", ALL_CLIENTS),
    supabase.from("fixed_services").delete().in("id", ALL_SERVICES),
    supabase.from("payment_methods").delete().in("id", ALL_METHODS),
  ];

  for (const op of deletions) {
    const { error } = await op;
    if (error) return { ok: false, error: error.message };
  }

  revalidateAll();
  return { ok: true };
}
