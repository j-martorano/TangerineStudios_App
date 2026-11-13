"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña tiene mínimo 6 caracteres"),
});

export type AuthResult = { ok: true } | { ok: false; error: string };

export async function signIn(formData: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Mensajes amigables para los errores más comunes
    if (error.message.toLowerCase().includes("invalid")) {
      return { ok: false, error: "Email o contraseña incorrectos" };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const ownPasswordSchema = z
  .string()
  .min(8, "La contraseña tiene que tener al menos 8 caracteres")
  .max(200);

/** El usuario logueado cambia su propia contraseña (p. ej. la temporal). */
export async function changeOwnPassword(password: string): Promise<AuthResult> {
  const parsed = ownPasswordSchema.safeParse(password);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Contraseña inválida" };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
