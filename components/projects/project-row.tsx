"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  ClipboardIcon,
  HardDriveIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";

import { CobroManager } from "./cobro-manager";
import { KanbanCardActions } from "./kanban-card-actions";
import { PagoManager } from "./pago-manager";
import { QuickPhaseBadge } from "./quick-phase-badge";
import { QuickPaymentBadge } from "./quick-payment-badge";
import type { ParentOption } from "./project-form";

import {
  updateProject,
} from "@/lib/projects/actions";
import {
  computeCost,
  computePrice,
  computeProfit,
  formatDate,
} from "@/lib/projects/format";
import { editorNames, isPack } from "@/lib/projects/types";
import type {
  ClientForProject,
  EditorMini,
  ProjectWithRelations,
} from "@/lib/projects/types";

// Compact "$250" format
const balanceFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
function fmt(v: number): string {
  return v < 0 ? `-${balanceFmt.format(Math.abs(v))}` : balanceFmt.format(v);
}

const ROW_BG_EVEN = "#1e1e1e";
const ROW_BG_ODD = "#232323";

type Props = {
  project: ProjectWithRelations;
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents?: ParentOption[];
  rowIndex: number;
  highlightId?: string;
  childIndex?: number;
  isLastChild?: boolean;
  forceBg?: string;
};

export function ProjectRow({
  project,
  editors,
  clients,
  availableParents = [],
  rowIndex,
  highlightId,
  childIndex,
  isLastChild = false,
  forceBg,
}: Props) {
  const isHighlighted = project.id === highlightId;
  const rowRef = useRef<HTMLTableRowElement>(null);
  const pack = isPack(project);
  const isChild = childIndex !== undefined;
  const locked = isChild ? false : project.finalized;
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isHighlighted) return;
    rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const price = computePrice(project);
  const cost = computeCost(project);
  const profit = computeProfit(project);

  const rowBg = forceBg ?? (rowIndex % 2 === 0 ? ROW_BG_EVEN : ROW_BG_ODD);

  return (
    <Fragment>
      <TableRow
        ref={rowRef}
        className={`border-b border-white/[0.04] transition-colors hover:brightness-110 ${
          project.archived ? "opacity-50" : ""
        } ${isHighlighted ? "ring-2 ring-inset ring-primary/50" : ""}`}
        style={{ backgroundColor: rowBg }}
      >
        {/* ── Col 1: pack expand+actions | child branch | regular actions ── */}
        <TableCell className="relative w-14 overflow-visible p-0 align-middle">
          {pack ? (
            <div className="flex items-center gap-0.5 px-2 py-2">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? "Colapsar" : "Expandir"}
                className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-white/10 hover:text-muted-foreground"
              >
                <ChevronDownIcon
                  className={`size-3.5 transition-transform duration-200 ${
                    expanded ? "" : "-rotate-90"
                  }`}
                />
              </button>
              <KanbanCardActions
                project={project}
                editors={editors}
                clients={clients}
                availableParents={availableParents}
              />
            </div>
          ) : isChild ? (
            <div className="relative py-2.5 pl-7 pr-2">
              <div
                className={`absolute left-4 w-px bg-white/10 ${
                  isLastChild ? "top-0 h-[calc(50%+1px)]" : "inset-y-0"
                }`}
              />
              <div className="absolute left-4 top-1/2 h-px w-3 -translate-y-px bg-white/10" />
              <span className="text-sm font-bold tabular-nums text-muted-foreground/45">
                {String(childIndex).padStart(2, "0")}
              </span>
            </div>
          ) : (
            <div className="flex items-center px-2 py-2">
              <KanbanCardActions
                project={project}
                editors={editors}
                clients={clients}
                availableParents={availableParents}
              />
            </div>
          )}
        </TableCell>

        {/* ── Col 2: Client chip ── */}
        <TableCell className="w-32 p-2 align-middle">
          {!isChild && project.client ? (
            <span
              className="inline-flex max-w-[116px] items-center overflow-hidden truncate rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: project.client.color ?? "#555" }}
            >
              <span className="truncate">{project.client.name}</span>
            </span>
          ) : null}
        </TableCell>

        {/* ── Col 3: Phase ── */}
        <TableCell className="w-36 p-2 align-middle">
          <QuickPhaseBadge id={project.id} phase={project.phase} disabled={locked} />
        </TableCell>

        {/* ── Col 4: Code (click to copy) ── */}
        <TableCell className="w-28 p-2 align-middle">
          <CopyCodeButton code={project.project_code} />
        </TableCell>

        {/* ── Col 5: Title ── */}
        <TableCell className="p-2 align-middle">
          <InlineTitleCell project={project} locked={locked} />
        </TableCell>

        {/* ── Col 6: Balance badges (nowrap with dark bg container) ── */}
        <TableCell className="w-44 p-2 align-middle">
          <span className="inline-flex items-center gap-1 rounded-md bg-black/20 px-1.5 py-1">
            {price != null ? (
              <span className="inline-flex items-center rounded border border-[#37ACFF]/30 bg-[#37ACFF]/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#37ACFF]">
                {fmt(price)}
              </span>
            ) : null}
            {cost != null ? (
              <span className="inline-flex items-center rounded border border-red-500/25 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-red-400">
                {fmt(cost)}
              </span>
            ) : null}
            {profit != null ? (
              <span
                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                  profit >= 0
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                    : "border-red-500/25 bg-red-500/10 text-red-400"
                }`}
              >
                {fmt(profit)}
              </span>
            ) : null}
            {price == null && cost == null && profit == null ? (
              <span className="text-xs text-muted-foreground/30">—</span>
            ) : null}
          </span>
        </TableCell>

        {/* ── Col 7: Cobrado ── */}
        <TableCell className="w-32 p-2 align-middle">
          <span className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground/45">Cobrado</span>
            <CobroManager project={project} disabled={locked} />
          </span>
        </TableCell>

        {/* ── Col 8: Pagado ── */}
        <TableCell className="w-32 p-2 align-middle">
          <span className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground/45">Pagado</span>
            <PagoManager project={project} disabled={locked} />
          </span>
        </TableCell>

        {/* ── Col 9: Facturado — read-only (se actualiza desde Finanzas) ── */}
        <TableCell className="w-36 p-2 align-middle">
          <span className={`flex items-center gap-1.5 ${locked ? "opacity-50" : ""}`}>
            <span className="text-[11px] text-muted-foreground/45">Facturado</span>
            <QuickPaymentBadge
              kind="invoiced"
              id={project.id}
              value={project.invoiced}
              disabled={true}
            />
          </span>
        </TableCell>

        {/* ── Col 10: Creation date ── */}
        <TableCell className="w-20 p-2 align-middle">
          <span className="text-xs text-muted-foreground/55">
            {project.created_at ? formatDate(project.created_at) : "—"}
          </span>
        </TableCell>

        {/* ── Col 11: Editors (functional mini-dialog) ── */}
        <TableCell className="w-44 p-2 align-middle">
          <EditorBadge
            project={project}
            editors={editors}
            locked={locked}
          />
        </TableCell>

        {/* ── Col 12: Actions (solo children, que no tienen espacio en Col 1) ── */}
        <TableCell className="w-10 p-2 pr-3 align-middle">
          {isChild ? (
            <KanbanCardActions
              project={project}
              editors={editors}
              clients={clients}
              availableParents={availableParents}
            />
          ) : null}
        </TableCell>
      </TableRow>

      {/* Pack children */}
      {pack && expanded && project.children && project.children.length > 0
        ? project.children.map((child, idx) => (
            <ProjectRow
              key={child.id}
              project={child}
              editors={editors}
              clients={clients}
              availableParents={availableParents}
              rowIndex={rowIndex}
              forceBg={rowBg}
              highlightId={highlightId}
              childIndex={idx + 1}
              isLastChild={idx === project.children!.length - 1}
            />
          ))
        : null}
    </Fragment>
  );
}

// ── Copy code button ──────────────────────────────────────────────────────

function CopyCodeButton({ code }: { code: string | null }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copiar código"
      className="flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors hover:bg-white/8"
    >
      {copied ? (
        <CheckIcon className="size-3.5 shrink-0 text-emerald-400" />
      ) : (
        <ClipboardIcon className="size-3.5 shrink-0 text-muted-foreground/35" />
      )}
      <span className="max-w-[80px] truncate font-mono text-xs text-muted-foreground/65">
        {code}
      </span>
    </button>
  );
}

// ── Inline title cell ─────────────────────────────────────────────────────

function InlineTitleCell({
  project,
  locked,
}: {
  project: ProjectWithRelations;
  locked: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.title);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurRef = useRef(false);

  function startEditing() {
    if (locked) return;
    skipBlurRef.current = false;
    setDraft(project.title);
    setEditing(true);
  }

  function cancel() {
    skipBlurRef.current = true;
    setEditing(false);
  }

  function commit() {
    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }
    const trimmed = draft.trim();
    if (!trimmed || trimmed === project.title) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const r = await updateProject(project.id, {
        title: trimmed,
        client_id: project.client_id,
        phase: project.phase,
        cobrado: project.cobrado,
        pagado: project.pagado,
        invoiced: project.invoiced,
        price: project.price != null ? Number(project.price) : null,
        cost: project.cost != null ? Number(project.cost) : null,
        duration_minutes:
          project.duration_minutes != null ? Number(project.duration_minutes) : null,
        project_type: project.project_type,
        parent_id: project.parent_id ?? null,
        finalized_at:
          project.phase === "terminado" ? (project.finalized_at ?? null) : null,
        children:
          project.project_type === "pack"
            ? (project.children ?? []).map((c) => ({
                id: c.id,
                title: c.title,
                project_type: (c.project_type !== "pack"
                  ? c.project_type
                  : "long_form") as "long_form" | "short_form" | "other",
              }))
            : [],
        editors: project.editors
          .filter((e) => e.editor != null)
          .map((e) => ({ id: e.editor!.id, cost: e.cost != null ? Number(e.cost) : null })),
      });
      if (r.ok) {
        setEditing(false);
      } else {
        toast.error(r.error);
      }
    });
  }

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (editing) {
    return (
      <span className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => {
            // Don't commit if focus moves to the confirm button
            if (e.relatedTarget?.getAttribute("data-confirm-title")) return;
            commit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); inputRef.current?.blur(); }
            if (e.key === "Escape") { e.preventDefault(); cancel(); }
          }}
          disabled={pending}
          className="min-w-0 flex-1 rounded border border-primary/50 bg-background/60 px-1.5 py-0.5 text-sm font-semibold outline-none ring-1 ring-primary/30 disabled:opacity-60"
          autoFocus
        />
        <button
          type="button"
          data-confirm-title="1"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { inputRef.current?.blur(); }}
          disabled={pending}
          aria-label="Confirmar"
          className="flex size-5 shrink-0 items-center justify-center rounded bg-primary/15 text-primary transition-colors hover:bg-primary/30 disabled:opacity-40"
        >
          <CheckIcon className="size-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span
      onDoubleClick={startEditing}
      className={`font-semibold ${locked ? "" : "cursor-text"}`}
      title={locked ? undefined : "Doble clic para editar"}
    >
      {project.title}
    </span>
  );
}

// ── Editor badge → mini dialog ────────────────────────────────────────────

type EditorBadgeProps = {
  project: ProjectWithRelations;
  editors: EditorMini[];
  locked: boolean;
};

function EditorBadge({ project, editors, locked }: EditorBadgeProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => !locked && setOpen(true)}
        disabled={locked}
        className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-xs text-muted-foreground/65 transition-colors hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <HardDriveIcon className="size-3.5 shrink-0" />
        <span className="max-w-[108px] truncate">
          {editorNames(project) || "Sin editor"}
        </span>
        <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground/30" />
      </button>

      <EditorsDialog
        project={project}
        editors={editors}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

// ── Editors-only mini form ────────────────────────────────────────────────

type EditorsDialogProps = {
  project: ProjectWithRelations;
  editors: EditorMini[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

type EditorEntry = { id: string; costDraft: string };

function EditorsDialog({ project, editors, open, onOpenChange }: EditorsDialogProps) {
  const [entries, setEntries] = useState<EditorEntry[]>([]);
  const [pending, startTransition] = useTransition();

  // Reset state each time the dialog opens
  useEffect(() => {
    if (open) {
      setEntries(
        project.editors
          .filter((e) => e.editor != null)
          .map((e) => ({
            id: e.editor!.id,
            costDraft: e.cost != null ? String(e.cost) : "",
          }))
      );
    }
  }, [open, project.editors]);

  const editorById = new Map(editors.map((ed) => [ed.id, ed.name]));
  const selectedIds = entries.map((e) => e.id);

  function addEditor() {
    const next = editors.find((ed) => !selectedIds.includes(ed.id));
    if (next) setEntries([...entries, { id: next.id, costDraft: "" }]);
  }

  function removeEditor(i: number) {
    setEntries(entries.filter((_, idx) => idx !== i));
  }

  function changeEditor(i: number, id: string) {
    setEntries(entries.map((e, idx) => (idx === i ? { ...e, id } : e)));
  }

  function changeCost(i: number, costDraft: string) {
    setEntries(entries.map((e, idx) => (idx === i ? { ...e, costDraft } : e)));
  }

  function handleSave() {
    const editorPayload: { id: string; cost: number | null }[] = [];
    for (const entry of entries) {
      const costStr = entry.costDraft.trim();
      if (costStr !== "") {
        const n = Number(costStr);
        if (Number.isNaN(n) || n < 0) {
          toast.error(`Costo inválido para ${editorById.get(entry.id) ?? "editor"}`);
          return;
        }
        editorPayload.push({ id: entry.id, cost: n });
      } else {
        editorPayload.push({ id: entry.id, cost: null });
      }
    }

    startTransition(async () => {
      const r = await updateProject(project.id, {
        title: project.title,
        client_id: project.client_id,
        phase: project.phase,
        cobrado: project.cobrado,
        pagado: project.pagado,
        invoiced: project.invoiced,
        price: project.price != null ? Number(project.price) : null,
        cost: project.cost != null ? Number(project.cost) : null,
        duration_minutes:
          project.duration_minutes != null ? Number(project.duration_minutes) : null,
        project_type: project.project_type,
        parent_id: project.parent_id ?? null,
        finalized_at:
          project.phase === "terminado" ? (project.finalized_at ?? null) : null,
        children:
          project.project_type === "pack"
            ? (project.children ?? []).map((c) => ({
                id: c.id,
                title: c.title,
                project_type: (c.project_type !== "pack" ? c.project_type : "long_form") as
                  | "long_form"
                  | "short_form"
                  | "other",
              }))
            : [],
        editors: editorPayload,
      });

      if (r.ok) {
        toast.success("Editores actualizados");
        onOpenChange(false);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Editores —{" "}
            <span className="font-normal text-muted-foreground">{project.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {entries.length > 0 ? (
            <>
              <div className="grid grid-cols-[1fr_120px_auto] gap-2 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <span>Editor</span>
                <span>Costo (USD)</span>
                <span className="w-7" />
              </div>
              {entries.map((entry, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_auto] items-center gap-2">
                  <Select
                    value={entry.id}
                    onValueChange={(v) => v && changeEditor(i, v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string | null) => (v ? (editorById.get(v) ?? "—") : "—")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {editors
                        .filter((ed) => ed.id === entry.id || !selectedIds.includes(ed.id))
                        .map((ed) => (
                          <SelectItem key={ed.id} value={ed.id}>
                            {ed.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={entry.costDraft}
                    onChange={(e) => changeCost(i, e.target.value)}
                    placeholder="auto"
                    className="h-9 text-right tabular-nums"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeEditor(i)}
                    aria-label="Quitar editor"
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Dejá el costo vacío para usar el cálculo automático.
              </p>
            </>
          ) : (
            <p className="text-xs italic text-muted-foreground">Sin editores asignados.</p>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addEditor}
            disabled={editors.length === 0 || selectedIds.length >= editors.length}
            className="w-fit"
          >
            <PlusIcon className="size-4" />
            Agregar editor
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
