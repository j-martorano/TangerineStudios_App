"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONTACT_TYPES,
  CONTACT_TYPE_LABEL,
  type ContactLink,
  type ContactType,
} from "@/lib/projects/types";

type Props = {
  value: ContactLink[];
  onChange: (links: ContactLink[]) => void;
};

export function ContactLinksEditor({ value, onChange }: Props) {
  function add() {
    const used = new Set(value.map((l) => l.type));
    const next = CONTACT_TYPES.find((t) => !used.has(t)) ?? "other";
    onChange([...value, { type: next, value: "" }]);
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  function update(i: number, patch: Partial<ContactLink>) {
    onChange(value.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-col gap-2">
          {value.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select
                value={link.type}
                onValueChange={(v) => v && update(i, { type: v as ContactType })}
              >
                <SelectTrigger className="w-[140px] shrink-0">
                  <SelectValue>
                    {(v: string | null) =>
                      v ? CONTACT_TYPE_LABEL[v as ContactType] : ""
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {CONTACT_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={link.value}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder={placeholderFor(link.type)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(i)}
                aria-label="Quitar contacto"
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="w-fit"
      >
        <PlusIcon className="size-4" />
        Agregar contacto
      </Button>
    </div>
  );
}

function placeholderFor(type: ContactType): string {
  switch (type) {
    case "email":     return "contacto@ejemplo.com";
    case "whatsapp":  return "+54 11 5555-5555";
    case "phone":     return "+54 11 5555-5555";
    case "instagram": return "@usuario";
    case "twitter":   return "@usuario";
    case "discord":   return "usuario o ID";
    case "slack":     return "@usuario";
    case "telegram":  return "@usuario";
    case "linkedin":  return "linkedin.com/in/usuario";
    default:          return "";
  }
}
