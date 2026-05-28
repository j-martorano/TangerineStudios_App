"use client";

import { useState, useTransition } from "react";
import { CheckIcon, ClipboardIcon, RefreshCwIcon, UnlinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  generateDiscordLinkToken,
  revokeDiscordLink,
} from "@/lib/editors/discord-actions";

type Props = {
  editorId: string;
  discordId: string | null;
  linkToken: string | null;
};

export function DiscordLinkCell({ editorId, discordId, linkToken }: Props) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [localToken, setLocalToken] = useState<string | null>(linkToken);
  const [localDiscordId, setLocalDiscordId] = useState<string | null>(discordId);

  // ── Linked ────────────────────────────────────────────────────────────────
  if (localDiscordId) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-emerald-500 font-medium">● Vinculado</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          title="Desvincular Discord"
          disabled={isPending}
          onClick={() => {
            if (!confirm("¿Desvincular la cuenta de Discord de este editor?")) return;
            startTransition(async () => {
              const res = await revokeDiscordLink(editorId);
              if (res.ok) {
                setLocalDiscordId(null);
                setLocalToken(null);
              }
            });
          }}
        >
          <UnlinkIcon className="size-3" />
        </Button>
      </div>
    );
  }

  // ── Has token (pending link) ───────────────────────────────────────────────
  if (localToken) {
    const copyToken = () => {
      navigator.clipboard.writeText(localToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="flex items-center gap-1">
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono tracking-widest select-all">
          {localToken}
        </code>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground"
          title="Copiar código"
          onClick={copyToken}
        >
          {copied ? (
            <CheckIcon className="size-3 text-emerald-500" />
          ) : (
            <ClipboardIcon className="size-3" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground"
          title="Regenerar código"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const res = await generateDiscordLinkToken(editorId);
              if (res.ok && res.token) setLocalToken(res.token);
            });
          }}
        >
          <RefreshCwIcon className="size-3" />
        </Button>
      </div>
    );
  }

  // ── No token yet ──────────────────────────────────────────────────────────
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-6 text-xs"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const res = await generateDiscordLinkToken(editorId);
          if (res.ok && res.token) setLocalToken(res.token);
        });
      }}
    >
      Generar código
    </Button>
  );
}
