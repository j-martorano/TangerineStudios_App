import { RESPONSE_SCHEMA } from "./ai-prompt";

/**
 * Llamada mínima a la API de Gemini (generateContent) con fetch, sin SDK.
 * Solo se importa desde actions.ts (servidor): la key nunca va al browser.
 * Se eligió Gemini por la cuota gratuita diaria. La key es la env
 * GEMINI_API_KEY (Vercel); GEMINI_API_BASE solo sirve para apuntar a un
 * servidor falso en pruebas locales.
 */

const DEFAULT_BASE = "https://generativelanguage.googleapis.com/v1beta";

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
};

/** Devuelve el texto (JSON) que generó el modelo. Tira GeminiError si falla. */
export async function generateJson(opts: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  signal?: AbortSignal;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new GeminiError("Falta configurar GEMINI_API_KEY en Vercel", 0);
  const base = (process.env.GEMINI_API_BASE?.trim() || DEFAULT_BASE).replace(/\/+$/, "");
  const url = `${base}/models/${encodeURIComponent(opts.model)}:generateContent`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: opts.userPrompt }] }],
        generationConfig: {
          temperature: 0.8,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
      signal: opts.signal ?? AbortSignal.timeout(60_000),
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error && e.name === "TimeoutError" ? "Gemini tardó demasiado en responder" : "No se pudo conectar con Gemini";
    throw new GeminiError(msg, 0);
  }

  let body: GeminiResponse | null = null;
  try {
    body = (await res.json()) as GeminiResponse;
  } catch {
    body = null;
  }

  if (!res.ok) {
    const detail = body?.error?.message ?? res.statusText;
    if (res.status === 429) {
      throw new GeminiError("Se alcanzó el límite gratuito de Gemini por ahora. Probá más tarde.", 429);
    }
    if (res.status === 400 || res.status === 403) {
      throw new GeminiError(`Gemini rechazó el pedido: ${detail}`, res.status);
    }
    if (res.status === 404) {
      throw new GeminiError(`El modelo «${opts.model}» no existe o no está disponible`, 404);
    }
    throw new GeminiError(`Error de Gemini (${res.status}): ${detail}`, res.status);
  }

  if (body?.promptFeedback?.blockReason) {
    throw new GeminiError("Gemini bloqueó el pedido por sus filtros de contenido", 200);
  }
  const cand = body?.candidates?.[0];
  const text = cand?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    const why = cand?.finishReason ? ` (${cand.finishReason})` : "";
    throw new GeminiError(`Gemini no devolvió texto${why}`, 200);
  }
  return text;
}
