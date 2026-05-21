import {
  BanknoteIcon,
  BitcoinIcon,
  CreditCardIcon,
  LandmarkIcon,
  SmartphoneIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

import { iconForKey } from "./icon-map";

// Heurística por nombre cuando el método no tiene un ícono elegido a mano.
function pickByName(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (
    n.includes("binance") ||
    n.includes("crypto") ||
    n.includes("usdt") ||
    n.includes("btc") ||
    n.includes("bitcoin")
  ) {
    return BitcoinIcon;
  }
  if (
    n.includes("dolar") ||
    n.includes("paypal") ||
    n.includes("wise") ||
    n.includes("zelle") ||
    n.includes("payoneer")
  ) {
    return SmartphoneIcon;
  }
  if (
    n.includes("banco") ||
    n.includes("bank") ||
    n.includes("cbu") ||
    n.includes("cvu") ||
    n.includes("cuenta")
  ) {
    return LandmarkIcon;
  }
  if (
    n.includes("tarjeta") ||
    n.includes("credit") ||
    n.includes("debit") ||
    n.includes("mastercard") ||
    n.includes("visa")
  ) {
    return CreditCardIcon;
  }
  if (n.includes("efectivo") || n.includes("cash")) {
    return BanknoteIcon;
  }
  return WalletIcon;
}

/**
 * Ícono asociado a un método de pago. Prioriza el ícono elegido a mano y
 * cae a la heurística por nombre si no hay nada.
 */
export function MethodIcon({
  name,
  icon,
  className,
}: {
  name: string;
  icon?: string | null;
  className?: string;
}) {
  const Icon = iconForKey(icon) ?? pickByName(name);
  return <Icon className={className ?? "size-3"} aria-hidden />;
}
