import { unstable_cache } from "next/cache";
import { createCacheClient } from "@/lib/supabase/server";
import { CACHE_TAGS } from "@/lib/cache-tags";

/** Método del catálogo global (ej. Binance, DolarApp, cuenta de banco). */
export type PaymentMethod = {
  id: string;
  name: string;
  icon: string | null;
  color: string;
};

/** Método de un editor concreto, con la info que guardó Joaco para él. */
export type EditorPaymentMethod = {
  method_id: string;
  name: string;
  info: string | null;
  icon: string | null;
  color: string;
};

export const fetchPaymentMethods = unstable_cache(
  async (): Promise<PaymentMethod[]> => {
    const supabase = createCacheClient();
    const { data, error } = await supabase
      .from("payment_methods")
      .select("id, name, icon, color")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as PaymentMethod[];
  },
  ["payment-methods"],
  { tags: [CACHE_TAGS.editors] }
);
