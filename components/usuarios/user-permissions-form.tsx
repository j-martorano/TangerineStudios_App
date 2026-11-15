"use client";

import { useState } from "react";
import { ShieldCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VISIBLE_TABS, TAB_DESCRIPTIONS, type Role, type TabKey } from "@/lib/auth/tabs";
import type { EditorChoice } from "@/lib/users/queries";

export type PermissionsValue = {
  email: string;
  displayName: string;
  role: Role;
  tabs: TabKey[];
  credentialIds: string[];
  /** Ficha de /editors vinculada (null: no es editor). */
  editorId: string | null;
};

const NO_EDITOR = "none";

type Props = {
  mode: "create" | "edit";
  initial: PermissionsValue;
  credentials: { id: string; name: string }[];
  /** Editores para «Es el editor…». Sin esta prop, el campo no se muestra. */
  editors?: EditorChoice[];
  /** Cuenta que se está editando: su propio editor sigue siendo elegible. */
  userId?: string | null;
  /** El vínculo viene dado (se crea desde la ficha del editor): se muestra, no se elige. */
  lockEditor?: boolean;
  /** Editando el propio usuario: no se puede cambiar el rol. */
  isSelf?: boolean;
  pending: boolean;
  submitLabel: string;
  onSubmit: (value: PermissionsValue) => void;
};

export function UserPermissionsForm({
  mode,
  initial,
  credentials,
  editors,
  userId = null,
  lockEditor = false,
  isSelf = false,
  pending,
  submitLabel,
  onSubmit,
}: Props) {
  const [value, setValue] = useState<PermissionsValue>(initial);
  const isAdmin = value.role === "admin";

  // Elegibles: sin cuenta y habilitados, más el que ya tiene esta cuenta.
  const editorOptions = (editors ?? []).filter(
    (e) =>
      e.id === value.editorId ||
      (userId != null && e.userId === userId) ||
      (e.userId == null && e.disabledAt == null)
  );
  const editorName = (id: string | null) =>
    (editors ?? []).find((e) => e.id === id)?.name ?? "";

  function toggleTab(key: TabKey) {
    setValue((v) => {
      const has = v.tabs.includes(key);
      const tabs = has ? v.tabs.filter((t) => t !== key) : [...v.tabs, key];
      // Sin la pestaña Bóveda no tiene sentido tener credenciales.
      const credentialIds = key === "boveda" && has ? [] : v.credentialIds;
      return { ...v, tabs, credentialIds };
    });
  }

  function toggleCredential(id: string) {
    setValue((v) => {
      const has = v.credentialIds.includes(id);
      const credentialIds = has
        ? v.credentialIds.filter((c) => c !== id)
        : [...v.credentialIds, id];
      // Dar una credencial implica ver la pestaña Bóveda.
      const tabs =
        !has && !v.tabs.includes("boveda") ? [...v.tabs, "boveda" as TabKey] : v.tabs;
      return { ...v, credentialIds, tabs };
    });
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="user-email">Email</Label>
          <Input
            id="user-email"
            type="email"
            required
            disabled={mode === "edit" || pending}
            value={value.email}
            onChange={(e) => setValue({ ...value, email: e.target.value })}
            placeholder="nombre@gmail.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="user-name">Nombre</Label>
          <Input
            id="user-name"
            disabled={pending}
            value={value.displayName}
            onChange={(e) => setValue({ ...value, displayName: e.target.value })}
            placeholder="Cómo aparece en la app"
          />
        </div>
      </div>

      {editors ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="user-editor">Es el editor</Label>
          {lockEditor ? (
            <p className="text-sm">{editorName(value.editorId)}</p>
          ) : (
            <Select
              value={value.editorId ?? NO_EDITOR}
              onValueChange={(v) =>
                setValue({ ...value, editorId: !v || v === NO_EDITOR ? null : v })
              }
              disabled={pending}
            >
              <SelectTrigger id="user-editor" className="w-full">
                <SelectValue>
                  {(v: string | null) =>
                    v && v !== NO_EDITOR ? editorName(v) : "Ninguno (no es editor)"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_EDITOR}>Ninguno (no es editor)</SelectItem>
                {editorOptions.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-muted-foreground">
            Une la cuenta con su ficha de Editores. Solo aparecen los editores
            que todavía no tienen cuenta.
          </p>
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-2" disabled={pending || isSelf}>
        <legend className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Rol
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["member", "Usuario", "Ve solo las pestañas que marques abajo."],
              ["admin", "Admin", "Ve todo y administra usuarios y la Bóveda."],
            ] as const
          ).map(([role, label, desc]) => (
            <label
              key={role}
              className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm transition-colors ${
                value.role === role
                  ? "border-primary/60 bg-primary/10"
                  : "border-border hover:bg-muted/40"
              }`}
            >
              <span className="flex items-center gap-2 font-medium">
                <input
                  type="radio"
                  name="role"
                  className="accent-primary"
                  checked={value.role === role}
                  onChange={() => setValue({ ...value, role })}
                />
                {role === "admin" ? <ShieldCheckIcon className="size-3.5 text-primary" /> : null}
                {label}
              </span>
              <span className="pl-5 text-xs text-muted-foreground">{desc}</span>
            </label>
          ))}
        </div>
        {isSelf ? (
          <p className="text-xs text-muted-foreground">
            No podés cambiar tu propio rol.
          </p>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-2" disabled={pending || isAdmin}>
        <legend className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Pestañas que puede ver
        </legend>
        {isAdmin ? (
          <p className="text-xs text-muted-foreground">Un admin ve todas.</p>
        ) : null}
        <div className="grid gap-1.5 sm:grid-cols-2">
          {VISIBLE_TABS.map((tab) => {
            const checked = isAdmin || value.tabs.includes(tab.key);
            return (
              <label
                key={tab.key}
                className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                  checked ? "border-foreground/25 bg-muted/40" : "border-border/60"
                } ${isAdmin ? "opacity-60" : ""}`}
              >
                <input
                  type="checkbox"
                  className="mt-1 accent-primary"
                  checked={checked}
                  onChange={() => toggleTab(tab.key)}
                />
                <span className="flex flex-col">
                  <span className="font-medium">{tab.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {TAB_DESCRIPTIONS[tab.key]}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2" disabled={pending}>
        <legend className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Contraseñas de la Bóveda que puede ver
        </legend>
        {credentials.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Todavía no hay credenciales cargadas. Se agregan desde la Bóveda.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {credentials.map((c) => {
              const checked = value.credentialIds.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                    checked
                      ? "border-primary/60 bg-primary/10"
                      : "border-border"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={checked}
                    onChange={() => toggleCredential(c.id)}
                  />
                  {c.name}
                </label>
              );
            })}
          </div>
        )}
        {isAdmin ? (
          <p className="text-xs text-muted-foreground">
            Un admin puede ver todas igual. Marcarlas solo hace que reciba los
            avisos cuando se roten.
          </p>
        ) : null}
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
