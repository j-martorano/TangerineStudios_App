import { createElement } from "react";
import {
  AtSignIcon,
  BotIcon,
  BriefcaseIcon,
  CameraIcon,
  FilmIcon,
  GlobeIcon,
  HashIcon,
  ImageIcon,
  LinkIcon,
  MailIcon,
  MegaphoneIcon,
  MessageCircleIcon,
  MessageSquareIcon,
  MicIcon,
  MonitorIcon,
  MusicIcon,
  NewspaperIcon,
  PhoneIcon,
  PlayIcon,
  SendIcon,
  SmartphoneIcon,
  SparklesIcon,
  StoreIcon,
  TvIcon,
  UsersIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { ResourceKind } from "@/lib/outreach/types";

/**
 * Catálogo de íconos para plataformas de outreach. lucide no trae logos de
 * marcas, así que son genéricos: el color de la plataforma hace el resto. Si
 * la plataforma tiene una imagen subida (`iconUrl`), se usa esa.
 */
export const PLATFORM_ICONS: readonly { key: string; Icon: LucideIcon; label: string }[] = [
  { key: "message-circle", Icon: MessageCircleIcon, label: "Chat / Reddit" },
  { key: "message-square", Icon: MessageSquareIcon, label: "Foro" },
  { key: "camera", Icon: CameraIcon, label: "Instagram / foto" },
  { key: "briefcase", Icon: BriefcaseIcon, label: "LinkedIn / trabajo" },
  { key: "mail", Icon: MailIcon, label: "Email" },
  { key: "send", Icon: SendIcon, label: "Mensaje directo" },
  { key: "globe", Icon: GlobeIcon, label: "Web / marketplace" },
  { key: "at-sign", Icon: AtSignIcon, label: "Mención" },
  { key: "hash", Icon: HashIcon, label: "Hashtag / X" },
  { key: "phone", Icon: PhoneIcon, label: "Teléfono / WhatsApp" },
  { key: "smartphone", Icon: SmartphoneIcon, label: "App" },
  { key: "users", Icon: UsersIcon, label: "Comunidad" },
  { key: "video", Icon: VideoIcon, label: "Video" },
  { key: "play", Icon: PlayIcon, label: "YouTube / play" },
  { key: "film", Icon: FilmIcon, label: "Película" },
  { key: "tv", Icon: TvIcon, label: "TV / Twitch" },
  { key: "music", Icon: MusicIcon, label: "TikTok / música" },
  { key: "mic", Icon: MicIcon, label: "Podcast" },
  { key: "image", Icon: ImageIcon, label: "Imagen" },
  { key: "newspaper", Icon: NewspaperIcon, label: "Newsletter / prensa" },
  { key: "monitor", Icon: MonitorIcon, label: "Escritorio" },
  { key: "store", Icon: StoreIcon, label: "Tienda" },
  { key: "megaphone", Icon: MegaphoneIcon, label: "Anuncio" },
  { key: "bot", Icon: BotIcon, label: "Bot" },
  { key: "link", Icon: LinkIcon, label: "Link" },
  { key: "sparkles", Icon: SparklesIcon, label: "Destacado" },
];

const BY_KEY = new Map(PLATFORM_ICONS.map((i) => [i.key, i.Icon]));

export function platformIconFor(key: string | null | undefined): LucideIcon {
  return (key && BY_KEY.get(key)) || GlobeIcon;
}

/** Ícono por defecto de los samples (el que propuso Joaco). */
export const SAMPLE_DEFAULT_ICON = "/outreach/sample.svg";

/** Imagen cuadrada con esquinas redondeadas (favicon, ícono subido…). */
function IconImage({ src, className }: { src: string; className?: string }) {
  // <img> a propósito: son URLs de Storage o favicons externos y next/image
  // exigiría declarar cada dominio.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={cn("size-4 shrink-0 rounded-[30%] object-cover", className)} />;
}

export function PlatformIcon({
  icon,
  iconUrl,
  className,
  style,
}: {
  icon: string | null | undefined;
  iconUrl?: string | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (iconUrl) return <IconImage src={iconUrl} className={className} />;
  // createElement en vez de <Icon/>: el ícono sale de un mapa y la regla
  // react-hooks/static-components no distingue eso de crear un componente.
  return createElement(platformIconFor(icon), {
    className: className ?? "size-4",
    style,
    "aria-hidden": true,
  });
}

/** Ícono de una página o sample: la imagen guardada, o el default de su tipo. */
export function ResourceIcon({
  kind,
  iconUrl,
  className,
}: {
  kind: ResourceKind;
  iconUrl: string | null | undefined;
  className?: string;
}) {
  if (iconUrl) return <IconImage src={iconUrl} className={className} />;
  if (kind === "sample") return <IconImage src={SAMPLE_DEFAULT_ICON} className={className} />;
  return <GlobeIcon className={cn("size-4 shrink-0 text-[#FFAC37]", className)} aria-hidden />;
}

/** Tinte suave de fondo a partir del color de la plataforma. */
export function platformTint(hex: string): string {
  return `${hex}1f`;
}

/** Chip con ícono y nombre, pintado con el color de la plataforma. */
export function PlatformChip({
  name,
  icon,
  iconUrl,
  color,
  className,
}: {
  name: string;
  icon: string | null | undefined;
  iconUrl?: string | null;
  color: string;
  className?: string;
}) {
  return (
    <span
      style={{ backgroundColor: platformTint(color), borderColor: color }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap",
        className
      )}
    >
      <PlatformIcon icon={icon} iconUrl={iconUrl} className="size-3" style={{ color }} />
      {name}
    </span>
  );
}

/** Chip de una página o sample (naranja / azul) con su ícono. */
export function ResourceChip({
  kind,
  name,
  iconUrl,
  href,
}: {
  kind: ResourceKind;
  name: string;
  iconUrl: string | null | undefined;
  href?: string;
}) {
  const cls = cn(
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap",
    kind === "sample" ? "border-[#37ACFF]/40 text-[#37ACFF]" : "border-[#FFAC37]/40 text-[#FFAC37]",
    href && "hover:underline"
  );
  const inner = (
    <>
      <ResourceIcon kind={kind} iconUrl={iconUrl} className="size-3" />
      {name}
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls} onClick={(e) => e.stopPropagation()}>
      {inner}
    </a>
  ) : (
    <span className={cls}>{inner}</span>
  );
}
