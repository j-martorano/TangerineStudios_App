import {
  BanknoteIcon,
  BitcoinIcon,
  CreditCardIcon,
  LandmarkIcon,
  SmartphoneIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

// Heurística simple por nombre del método. Si Joaco escribe algo nuevo, le
// caemos al ícono genérico (Wallet) y listo. Más adelante podemos hacer que
// cada método tenga su ícono elegido a mano.
function pickIcon(name: string): LucideIcon {
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

/** Ícono asociado al nombre de un método de pago. */
export function MethodIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = pickIcon(name);
  return <Icon className={className ?? "size-3"} aria-hidden />;
}
