import { DEFAULT_AI_MODEL, FALLBACK_AI_MODELS, RESPONSE_SCHEMA } from "./ai-prompt";

/**
 * Llamada mínima a la API de Gemini (generateContent) con fetch, sin SDK.
 * Solo se importa desde actions.ts (servidor): la key nunca va al browser.
 * Se eligió Gemini por la cuota gratuita diaria. La key es la env
 * GEMINI_API_KEY (Vercel); GEMINI_API_BASE solo sirve para apuntar a un
 * servidor falso en pruebas locales.
 *
 * La cuota gratuita es frágil: los modelos nuevos suelen estar saturados
 * (503 o cuelgues largos) y Google retira los viejos para cuentas nuevas
 * (404). Por eso se prueba una cadena de modelos, cada uno con un timeout
 * corto, y se apaga el "thinking" (para un mensaje de 100 palabras no hace
 * falta y multiplica por 20 el tiempo de respuesta).
 */

const DEFAULT_BASE = "https://generativelanguage.googleapis.com/v1beta";
/** Por intento. Con thinking apagado un modelo sano responde en 2–6 s. */
const ATTEMPT_TIMEOUT_MS = 20_000;

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

type GenerateOpts = {
  model: string;
  systemInstruction: string;
  userPrompt: string;
};

/** Errores con los que vale la pena probar el siguiente modelo de la cadena. */
const RETRY_WITH_NEXT_MODEL = new Set([404, 408, 503, 504]);

/**
 * Devuelve el texto (JSON) que generó el modelo. Tira GeminiError si falla.
 * Prueba el modelo pedido y después los de reserva; si el error es de otro
 * tipo (key inválida, pedido rechazado, filtros) corta ahí.
 */
export async function generateJson(opts: GenerateOpts): Promise<string> {
  const models = [...new Set([opts.model, DEFAULT_AI_MODEL, ...FALLBACK_AI_MODELS])];
  let lastError: GeminiError | null = null;
  for (const model of models) {
    try {
      return await callModel({ ...opts, model });
    } catch (e) {
      if (!(e instanceof GeminiError) || !RETRY_WITH_NEXT_MODEL.has(e.status)) throw e;
      lastError = e;
    }
  }
  throw lastError ?? new GeminiError("No se pudo generar el mensaje", 0);
}

/** Un modelo: primero con thinking apagado; si lo rechaza (400), de nuevo sin ese parámetro. */
async function callModel(opts: GenerateOpts): Promise<string> {
  try {
    return await request(opts, true);
  } catch (e) {
    if (e instanceof GeminiError && e.status === 400) return request(opts, false);
    throw e;
  }
}

async function request(opts: GenerateOpts, disableThinking: boolean): Promise<string> {
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
          ...(disableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      throw new GeminiError("Gemini tardó demasiado en responder. Probá de nuevo en un rato.", 504);
    }
    throw new GeminiError("No se pudo conectar con Gemini", 0);
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
      // Google explica en el detalle si el modelo fue retirado y cuál usar en su lugar.
      throw new GeminiError(`El modelo «${opts.model}» no está disponible. ${detail}`.trim(), 404);
    }
    if (res.status === 503) {
      throw new GeminiError("Gemini está saturado en este momento. Probá de nuevo en un rato.", 503);
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
