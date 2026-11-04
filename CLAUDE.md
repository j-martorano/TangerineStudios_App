# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

App interna de **Tangerine Studios** (estudio de edición de video) para gestionar proyectos, clientes, editores, cobros, pagos y facturas. Un solo tenant, pocos usuarios (Joaco es el dueño del negocio). Todo en español: UI, comentarios, commits.

Stack: Next.js 16 (App Router, React 19, Server Components + Server Actions), Supabase (Postgres + Auth), Tailwind v4 + shadcn (estilo `base-nova`, primitivas de `@base-ui/react`), dnd-kit, recharts, `@react-pdf/renderer`, zod. Deploy en Vercel.

## Comandos

```bash
npm run build     # next build — la única forma de verificar que compila
npm run lint      # eslint
node scripts/register-discord-commands.mjs   # re-registrar slash commands del bot (lee .env.local)
node scripts/fix-encoding.mjs                # arreglar mojibake UTF-8/cp1252 en fuentes (histórico de Windows)
```

No hay tests. No hay `npm run dev` utilizable (ver abajo).

## Reglas duras del entorno

- **Nunca correr `npm run dev`**, ni en background ni sugiriéndolo. En esta PC genera miles de procesos Node y la cuelga. Para probar cambios: `npm run build` local y después push a `main`.
- **Deploy automático**: cada push a `main` deploya a producción en Vercel (cuenta de Joaco). No correr `vercel --prod`.
- **Migraciones automáticas**: un archivo nuevo en `supabase/migrations/` se aplica solo vía GitHub Actions (`.github/workflows/migrate.yml`) al pushear a `main`. **No correr `supabase db push`** ni ningún comando de migración manual. El workflow hace `migration repair` de una lista fija de migraciones viejas (la DB se creó a mano); migraciones nuevas no hay que agregarlas ahí.
- **Git**: un commit + push por fix/feature apenas está listo, sin acumular. Mensajes estilo `tipo(área): descripción` en español (`fix(kanban): …`, `feat(finanzas): …`). **Sin línea `Co-Authored-By`.**
- `.env.local` y `.mcp.json` están gitignoreados y contienen secretos. No leerlos ni copiarlos.
- Toda migración que cambie tablas o enums va acompañada en el mismo commit por la actualización de `lib/database.types.ts` (salida de `supabase gen types`); todo el tipado de dominio deriva de ahí.

## Arquitectura

### Capas

```
app/(app)/<ruta>/page.tsx      Server Components. Hacen fetch en paralelo y pasan props a componentes cliente.
lib/<dominio>/queries.ts       Lecturas. unstable_cache + service-role client.
lib/<dominio>/actions.ts       "use server". Validan con zod, escriben con el client de sesión, revalidan.
lib/<dominio>/types.ts         Tipos y constantes de dominio (labels, listas de enums).
components/<dominio>/          Componentes (casi todos "use client"). components/ui/ es shadcn.
```

Dominios: `projects`, `clients`, `editors`, `finanzas`, `invoices`, `payment-methods`, `settings`, `sub-clients`, `discord`, `auth`, `seed`.

### Dos clientes de Supabase, a propósito

- **Lecturas** (`queries.ts`) usan `createBotClient()` (`lib/supabase/bot.ts`, service role, salta RLS) porque corren dentro de `unstable_cache`, donde no hay cookies de sesión.
- **Escrituras** (`actions.ts`) usan `createClient()` (`lib/supabase/server.ts`, sesión del usuario, con RLS).
- `proxy.ts` (el middleware de Next 16) refresca la sesión y redirige a `/login` si no hay usuario. Excluye `/api/discord/` porque el bot no tiene sesión.
- El service role **nunca** va al browser.

### Caché e invalidación

Los tags viven en `lib/cache-tags.ts` (`projects`, `clients`, `editors`, `finanzas`, `invoices`, `settings`, `templates`). Cada query cacheada declara sus tags; cada action que escribe llama `revalidateTag(...)` de todos los tags afectados **y además** `revalidatePath` de las rutas que lo muestran. Si una pantalla queda desactualizada después de una action, casi siempre falta un tag o un path acá.

### Modelo de datos (lo no obvio)

- `projects` tiene `phase` (`por_asignar → editando → en_revision → terminado`), tres estados independientes `cobrado` / `pagado` / `invoiced` (cada uno `si|no|parcial` o equivalente), y flags `finalized` / `archived`.
- **Packs**: `project_type = 'pack'` con hijos vía `parent_id`. El kanban muestra solo top-level (los hijos van dentro de la card del pack). `attachParentChildLinks` en `queries.ts` arma las referencias en memoria.
- **Multi-editor**: pivot `project_editors` con `cost` manual opcional por asignación.
- **Cobros y pagos son registros**, no solo flags: `project_cobros` (lo que pagó el cliente) y `project_editor_pagos` (lo que se le pagó a cada editor), ambos con `paid_at`. Los totales de plata se calculan desde estas fechas reales.
- **Modelos de pago**. Cliente: `por_proyecto` (precio fijo), `por_rate` (precio × minutos) o `mensual` (retainer con minutos acreditados por `client_payments` y descuento `retainer_discount_pct`). Editor: `flat`, `flat_variable` (tramos por minutos en `editor_payment_tiers`) o `por_minuto`. El par cliente-editor (`client_editors` + `client_editor_payment_tiers`) puede **overridear** el modelo global del editor; `applyPairOverrides` en `queries.ts` lo resuelve.
- Precio, costo y ganancia de un proyecto **no están en la DB**: se derivan con `computePrice` / `computeCost` / `computeProfit` en `lib/projects/format.ts`. `price` y `cost` en la fila son overrides manuales.
- `user_settings.prefs` guarda preferencias personales (columnas visibles, tabs de Finanzas, límites). `mergePrefs` en `lib/settings/types.ts` rellena columnas nuevas que el usuario no tenía guardadas.
- Moneda única USD. Fechas de negocio en zona Argentina: usar `todayAR()` / `nowISOArgentina()` de `lib/argentina-date.ts` al guardar `finalized_at` / `paid_at`, nunca `new Date().toISOString()`, para que el bucketing por mes (que extrae en UTC) caiga en el mes correcto.

### Bucketing por mes (fuente frecuente de bugs)

En qué mes se **muestra** un proyecto lo decide una sola función: `projectEffectiveMonthKey` en `lib/projects/month-bucket.ts`. La usan kanban, spreadsheet (`/projects`) y finanzas; antes cada uno tenía su copia y se desincronizaban. Regla: retainer → mes de `finalized_at`; resto → mes del último cobro; sin cobrar → mes actual, aunque esté terminado. `cobrado: "parcial"` no mueve la card.

Eso es presentación. **La plata va por fechas reales** (`cobros[].paid_at`, `editor_pagos[].paid_at`), calculada aparte en `TerminadoStats` (kanban) y `computeMonthMetrics` (dashboard). Un proyecto puede mostrarse en un mes y sumar en otro. No volver a escribir la cascada a mano.

### Rutas

| Ruta | Qué es |
|---|---|
| `/` | Dashboard mensual (stats, activos, tasks pendientes). Navegación por `?month=YYYY-MM`. |
| `/kanban` | Tablero por fase con dnd-kit. Columna "terminado" agrupada por mes. |
| `/projects` | Lo que Joaco llama **"spreadsheet"**: tabla por año (`ProjectsTable`). |
| `/clients`, `/editors` | CRUD con tablas configurables. |
| `/finanzas` | Tabs: resumen, por mes, pagos retainer, por proyecto, cobros pendientes, servicios fijos. |
| `/facturas` | Facturas con PDF (`lib/invoices/pdf.tsx`) subido a Supabase Storage. |
| `/configuracion` | Preferencias de usuario, métodos de pago, datos de facturación, seed. |
| `/admin` | Backfill de fechas de cobros/pagos del sistema anterior. |
| `/api/discord/interactions` | Webhook del bot de Discord. |

### Bot de Discord

Slash commands para que los editores vean y muevan sus proyectos desde Discord. Flujo: `app/api/discord/interactions/route.ts` verifica firma Ed25519 (`lib/discord/verify.ts`) y despacha a `lib/discord/commands/index.ts`. Para agregar un comando: crear `lib/discord/commands/<nombre>.ts`, registrarlo en `COMMANDS` (y `AUTOCOMPLETE` si aplica), agregarlo a `COMMAND_DEFINITIONS` en `scripts/register-discord-commands.mjs` y correr ese script. Los editores se vinculan a su usuario de Discord con `/vincular` (token generado desde `/editors`). `DISCORD_JOACO_ID` identifica al admin, que puede mover cualquier proyecto. Las notificaciones (`lib/discord/notify.ts`) son fire-and-forget: nunca tiran error hacia la acción que las dispara.

### UI

- Dark puro (`#111111`), fuente Outfit, títulos de página `text-5xl font-bold uppercase`. Colores de marca: naranja `#FFAC37`, azul `#37ACFF`, verde `#37FF62`, rojo `#FF3737`.
- Los montos están **ocultos por default** y se muestran con el "ojito" (`AmountsToggle` / `Money` en `components/ui/amount.tsx`, estado en `AmountsProvider` del layout). Cualquier monto nuevo debe pasar por `Money`.
- Portals (Dialog, Popover, Select, Tooltip, DropdownMenu) usan `z-[200]` para apilarse bien sobre dialogs; mantener esa convención.
- Las páginas leen filtros de `searchParams` (`q`, `year`, `month`, `archived`, `tab`) y los componentes cliente navegan con `router.push`, no con estado local.

## Datos de referencia

- `supabase/schema_completo.sql` es un snapshot concatenado de las migraciones, útil para leer el esquema de un tirón; la verdad son los archivos de `supabase/migrations/`.
- `lib/seed/actions.ts` crea datos de prueba con IDs prefijados `dddddddd-` y nombres `[SEED]`, solo visibles para el email dueño del seed.
- Hay un MCP de Supabase read-only configurado localmente que apunta al proyecto de producción de Joaco; ese ref es distinto al de la app local. Confirmar a cuál se quiere consultar antes de sacar conclusiones de datos.
