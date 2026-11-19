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

import { createElement } from "react";

import { cn } from "@/lib/utils";

/**
 * Catálogo de íconos para plataformas de outreach. lucide no trae logos de
 * marcas, así que son genéricos: el color de la plataforma hace el resto.
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

export function PlatformIcon({
  icon,
  className,
  style,
}: {
  icon: string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
}) {
  // createElement en vez de <Icon/>: el ícono sale de un mapa y la regla
  // react-hooks/static-components no distingue eso de crear un componente.
  return createElement(platformIconFor(icon), {
    className: className ?? "size-4",
    style,
    "aria-hidden": true,
  });
}

/** Tinte suave de fondo a partir del color de la plataforma. */
export function platformTint(hex: string): string {
  return `${hex}1f`;
}

/** Chip con ícono y nombre, pintado con el color de la plataforma. */
export function PlatformChip({
  name,
  icon,
  color,
  className,
}: {
  name: string;
  icon: string | null | undefined;
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
      <PlatformIcon icon={icon} className="size-3" style={{ color }} />
      {name}
    </span>
  );
}
