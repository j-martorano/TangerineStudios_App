"use client";

import { useState } from "react";
import { ClockIcon, PlusIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { ProjectForm, type ParentOption } from "./project-form";
import type { ClientForProject, EditorMini } from "@/lib/projects/types";

const btnBase =
  "inline-flex items-center gap-2 text-sm font-medium transition-colors active:scale-[0.98]";
const btnStyle = { borderRadius: "6px", padding: "6px 12px" };

export function NewProjectButton({
  editors,
  clients,
  availableParents = [],
}: {
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents?: ParentOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className={`${btnBase} bg-[#FFAC37] text-black hover:bg-[#FFAC37]/85`}
            style={btnStyle}
          />
        }
      >
        <PlusIcon className="size-4" />
        Nuevo Proyecto
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo proyecto</DialogTitle>
          <DialogDescription>
            Cargá los datos. Si el cliente no está en la lista, lo creás desde
            el combobox.
          </DialogDescription>
        </DialogHeader>
        <ProjectForm
          mode="create"
          editors={editors}
          clients={clients}
          availableParents={availableParents}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

export function NewHistoricProjectButton({
  editors,
  clients,
  availableParents = [],
}: {
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents?: ParentOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className={`${btnBase} border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80`}
            style={btnStyle}
          />
        }
      >
        <ClockIcon className="size-4" />
        Nuevo Proyecto Histórico
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo proyecto histórico</DialogTitle>
          <DialogDescription>
            Cargá un proyecto ya terminado. Elegí la fecha en que se terminó
            para que aparezca en el mes correcto.
          </DialogDescription>
        </DialogHeader>
        <ProjectForm
          mode="create"
          editors={editors}
          clients={clients}
          availableParents={availableParents}
          initialPhase="terminado"
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
