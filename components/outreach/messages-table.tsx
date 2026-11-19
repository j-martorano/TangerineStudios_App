"use client";

import { Fragment, useState } from "react";
import { CopyIcon, ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";

import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { currentMonthKeyAR } from "@/lib/argentina-date";
import type { OutreachMessage, OutreachPlatform } from "@/lib/outreach/types";

import { MessageDialog } from "./message-dialog";
import { PlatformChip, ResourceChip } from "./platform-icon";
import { QuickStatusBadge } from "./status-badge";

/**
 * Registro de mensajes enviados, con el mismo formato que el spreadsheet de
 * proyectos: un bloque por mes (según la fecha de envío), del más reciente al
 * más viejo, con el mes actual siempre arriba aunque esté vacío.
 */

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${MONTH_NAMES[Number(month) - 1] ?? "?"} ${year}`;
}

/** "2026-11-19" → "19/11" sin pasar por Date (evita corrimientos de zona). */
function dayLabel(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

const COL_HEADERS = [
  { label: "Fecha", className: "w-16" },
  { label: "Cliente", className: "w-44" },
  { label: "Plataforma", className: "w-36" },
  { label: "Estado", className: "w-32" },
  { label: "Post", className: "w-14" },
  { label: "Páginas y samples", className: "w-64" },
  { label: "Mensaje", className: "" },
  { label: "", className: "w-10" },
] as const;

const COL_SPAN = COL_HEADERS.length;
const ROW_BG_EVEN = "#1e1e1e";
const ROW_BG_ODD = "#232323";

type Props = {
  messages: OutreachMessage[];
  platforms: OutreachPlatform[];
};

export function OutreachTable({ messages, platforms }: Props) {
  const [editing, setEditing] = useState<OutreachMessage | null>(null);
  const currentMK = currentMonthKeyAR();

  const map = new Map<string, OutreachMessage[]>();
  for (const m of messages) {
    const key = m.sentAt.slice(0, 7);
    const arr = map.get(key);
    if (arr) arr.push(m);
    else map.set(key, [m]);
  }
  const groups = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  // El mes actual va primero aunque todavía no tenga mensajes (si es de este año).
  if (
    !map.has(currentMK) &&
    (groups.length === 0 || groups[0][0].slice(0, 4) === currentMK.slice(0, 4))
  ) {
    groups.unshift([currentMK, []]);
  }

  const platformById = new Map(platforms.map((p) => [p.id, p]));

  return (
    <>
      <Table>
        <TableBody>
          {groups.map(([key, items]) => (
            <Fragment key={key}>
              <TableRow style={{ backgroundColor: "#4C4C4C" }} className="border-0 hover:bg-transparent">
                <TableCell colSpan={COL_SPAN} className="px-4 py-4">
                  <span className="text-4xl font-bold uppercase tracking-tight leading-none">
                    {monthLabel(key)}
                  </span>
                  <span className="ml-3 text-sm text-white/50">
                    {items.length} mensaje{items.length === 1 ? "" : "s"}
                  </span>
                </TableCell>
              </TableRow>
              <TableRow
                className="border-b border-white/[0.06] hover:bg-transparent"
                style={{ backgroundColor: "#0e0e0e" }}
              >
                {COL_HEADERS.map((col, i) => (
                  <TableCell
                    key={i}
                    className={`${col.className} py-2 ${i === 0 ? "px-4" : i === COL_SPAN - 1 ? "pr-3 pl-2" : "px-2"}`}
                  >
                    {col.label ? (
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                        {col.label}
                      </span>
                    ) : null}
                  </TableCell>
                ))}
              </TableRow>
              {items.length === 0 ? (
                <TableRow className="hover:bg-transparent" style={{ backgroundColor: ROW_BG_EVEN }}>
                  <TableCell colSpan={COL_SPAN} className="px-4 py-3 text-sm text-muted-foreground/50">
                    Todavía no hay mensajes este mes.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((m, idx) => (
                  <MessageRow
                    key={m.id}
                    message={m}
                    platform={m.platformId ? (platformById.get(m.platformId) ?? null) : null}
                    bg={idx % 2 === 0 ? ROW_BG_EVEN : ROW_BG_ODD}
                    onOpen={() => setEditing(m)}
                  />
                ))
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>

      <MessageDialog
        message={editing}
        platforms={platforms}
        open={editing != null}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function MessageRow({
  message: m,
  platform,
  bg,
  onOpen,
}: {
  message: OutreachMessage;
  platform: OutreachPlatform | null;
  bg: string;
  onOpen: () => void;
}) {
  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(m.message);
      toast.success("Mensaje copiado");
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  }

  const firstLine = m.message.split("\n").find((l) => l.trim()) ?? "";

  return (
    <TableRow
      style={{ backgroundColor: bg }}
      onClick={onOpen}
      className="cursor-pointer border-b border-white/[0.04] transition-colors hover:brightness-110"
    >
      <TableCell className="px-4 py-2.5 tabular-nums text-muted-foreground">{dayLabel(m.sentAt)}</TableCell>
      <TableCell className="px-2 py-2.5 font-medium">{m.clientName}</TableCell>
      <TableCell className="px-2 py-2.5">
        {platform ? (
          <PlatformChip name={platform.name} icon={platform.icon} iconUrl={platform.iconUrl} color={platform.color} />
        ) : m.platformName ? (
          <PlatformChip name={m.platformName} icon={null} color="#888888" />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="px-2 py-2.5">
        <QuickStatusBadge id={m.id} status={m.status} />
      </TableCell>
      <TableCell className="px-2 py-2.5">
        {m.postUrl ? (
          <a
            href={m.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex text-muted-foreground hover:text-foreground"
            aria-label="Abrir post"
            title={m.postUrl}
          >
            <ExternalLinkIcon className="size-4" />
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="px-2 py-2.5">
        {m.resources.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {m.resources.map((r, i) => (
              <ResourceChip key={i} kind={r.kind} name={r.name} iconUrl={r.iconUrl} />
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="max-w-0 px-2 py-2.5">
        <span className="block truncate text-muted-foreground" title={m.message}>
          {firstLine}
        </span>
      </TableCell>
      <TableCell className="pr-3 pl-2 py-2.5">
        <button
          type="button"
          onClick={copy}
          className="inline-flex text-muted-foreground hover:text-foreground"
          aria-label="Copiar mensaje"
        >
          <CopyIcon className="size-4" />
        </button>
      </TableCell>
    </TableRow>
  );
}
