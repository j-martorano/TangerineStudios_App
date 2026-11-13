"use client";

import { useState } from "react";
import { ShieldCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TABS, TAB_DESCRIPTIONS, type Role, type TabKey } from "@/lib/auth/tabs";

export type PermissionsValue = {
  email: string;
  displayName: string;
  role: Role;
  tabs: TabKey[];
  credentialIds: string[];
};

type Props = {
  mode: "create" | "edit";
  initial: PermissionsValue;
  credentials: { id: string; name: string }[];
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
  isSelf = false,
  pending,
  submitLabel,
  onSubmit,
}: Props) {
  const [value, setValue] = useState<PermissionsValue>(initial);
  const isAdmin = value.role === "admin";

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
                  ? "border-[#FFAC37]/60 bg-[#FFAC37]/10"
                  : "border-white/[0.08] hover:bg-white/[0.03]"
              }`}
            >
              <span className="flex items-center gap-2 font-medium">
                <input
                  type="radio"
                  name="role"
                  className="accent-[#FFAC37]"
                  checked={value.role === role}
                  onChange={() => setValue({ ...value, role })}
                />
                {role === "admin" ? <ShieldCheckIcon className="size-3.5 text-[#FFAC37]" /> : null}
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
          {TABS.map((tab) => {
            const checked = isAdmin || value.tabs.includes(tab.key);
            return (
              <label
                key={tab.key}
                className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                  checked ? "border-white/[0.15] bg-white/[0.04]" : "border-white/[0.06]"
                } ${isAdmin ? "opacity-60" : ""}`}
              >
                <input
                  type="checkbox"
                  className="mt-1 accent-[#FFAC37]"
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
                      ? "border-[#FFAC37]/60 bg-[#FFAC37]/10"
                      : "border-white/[0.08]"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="accent-[#FFAC37]"
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
