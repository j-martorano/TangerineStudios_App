import {
  BadgeDollarSignIcon,
  BanknoteIcon,
  BitcoinIcon,
  Building2Icon,
  CircleDollarSignIcon,
  CoinsIcon,
  CreditCardIcon,
  DollarSignIcon,
  GemIcon,
  HandCoinsIcon,
  HandshakeIcon,
  LandmarkIcon,
  PiggyBankIcon,
  QrCodeIcon,
  ReceiptIcon,
  SmartphoneIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

/**
 * Catálogo de íconos disponibles para métodos de pago. Si Joaco crea un
 * método con uno de estos keys, lo mostramos. Si elige ninguno, hacemos
 * heurística por nombre como fallback.
 */
export type PaymentMethodIconKey =
  | "wallet"
  | "credit-card"
  | "landmark"
  | "smartphone"
  | "bitcoin"
  | "coins"
  | "banknote"
  | "dollar-sign"
  | "circle-dollar-sign"
  | "badge-dollar-sign"
  | "piggy-bank"
  | "receipt"
  | "hand-coins"
  | "handshake"
  | "qr-code"
  | "building-2"
  | "gem";

export const PAYMENT_METHOD_ICONS: readonly {
  key: PaymentMethodIconKey;
  Icon: LucideIcon;
  label: string;
}[] = [
  { key: "wallet", Icon: WalletIcon, label: "Billetera" },
  { key: "credit-card", Icon: CreditCardIcon, label: "Tarjeta" },
  { key: "landmark", Icon: LandmarkIcon, label: "Banco" },
  { key: "smartphone", Icon: SmartphoneIcon, label: "App / móvil" },
  { key: "bitcoin", Icon: BitcoinIcon, label: "Cripto" },
  { key: "coins", Icon: CoinsIcon, label: "Monedas" },
  { key: "banknote", Icon: BanknoteIcon, label: "Efectivo" },
  { key: "dollar-sign", Icon: DollarSignIcon, label: "Dólar" },
  {
    key: "circle-dollar-sign",
    Icon: CircleDollarSignIcon,
    label: "Dólar redondo",
  },
  {
    key: "badge-dollar-sign",
    Icon: BadgeDollarSignIcon,
    label: "Insignia $",
  },
  { key: "piggy-bank", Icon: PiggyBankIcon, label: "Alcancía" },
  { key: "receipt", Icon: ReceiptIcon, label: "Recibo" },
  { key: "hand-coins", Icon: HandCoinsIcon, label: "Mano con monedas" },
  { key: "handshake", Icon: HandshakeIcon, label: "Apretón" },
  { key: "qr-code", Icon: QrCodeIcon, label: "QR" },
  { key: "building-2", Icon: Building2Icon, label: "Edificio / oficina" },
  { key: "gem", Icon: GemIcon, label: "Premium" },
] as const;

const ICONS_BY_KEY: Record<PaymentMethodIconKey, LucideIcon> = Object.fromEntries(
  PAYMENT_METHOD_ICONS.map((entry) => [entry.key, entry.Icon])
) as Record<PaymentMethodIconKey, LucideIcon>;

/** Devuelve el componente lucide para una key conocida, o null si no coincide. */
export function iconForKey(
  key: string | null | undefined
): LucideIcon | null {
  if (!key) return null;
  return ICONS_BY_KEY[key as PaymentMethodIconKey] ?? null;
}

/**
 * Paleta predefinida para los chips de métodos de pago. Joaco elige uno y
 * el chip se pinta con su color (tint suave de fondo).
 */
export const PAYMENT_METHOD_COLORS: readonly string[] = [
  "#888888", // gris (default)
  "#ef4444", // rojo
  "#f97316", // naranja
  "#f59e0b", // ámbar
  "#eab308", // amarillo
  "#84cc16", // lima
  "#22c55e", // verde
  "#10b981", // esmeralda
  "#06b6d4", // cyan
  "#3b82f6", // azul
  "#6366f1", // índigo
  "#a855f7", // violeta
  "#ec4899", // rosa
] as const;

/** Tinte de fondo para los chips a partir del color del método. */
export function methodTint(hex: string | null | undefined): string | undefined {
  if (!hex) return undefined;
  return `${hex}1f`; // hex de 8 dígitos: #RRGGBB + alpha 0x1f
}
