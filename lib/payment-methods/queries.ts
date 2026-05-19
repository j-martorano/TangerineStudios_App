import { createClient } from "@/lib/supabase/server";

/** Método del catálogo global (ej. Binance, DolarApp, cuenta de banco). */
export type PaymentMethod = {
  id: string;
  name: string;
};

/** Método de un editor concreto, con la info que guardó Joaco para él. */
export type EditorPaymentMethod = {
  method_id: string;
  name: string;
  info: string | null;
};

export async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, name")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as PaymentMethod[];
}
