-- Outreach con IA: el mensaje lo arma Gemini a partir del contexto del lead
-- (quién es, qué publicó) y de la descripción de cada página y sample.
--
-- Se guarda en outreach_settings el prompt del sistema (editable por Joaco;
-- null = el prompt por defecto que vive en lib/outreach/ai-prompt.ts) y el
-- modelo a usar (null = el default del código). La API key no va en la DB:
-- es la env GEMINI_API_KEY de Vercel.
--
-- No hace falta tocar tabs_for ni las policies: son columnas nuevas de una
-- tabla que ya está dentro de la pestaña «outreach».

alter table public.outreach_settings
  add column if not exists ai_prompt text,
  add column if not exists ai_model  text;

comment on column public.outreach_settings.ai_prompt is
  'Instrucciones para la IA que arma mensajes. Null = prompt por defecto del código.';
comment on column public.outreach_settings.ai_model is
  'Modelo de Gemini a usar. Null = default del código.';

comment on column public.outreach_resources.description is
  'Contexto para la IA: qué es exactamente este link (rubro, estilo, tipo de video). También sirve para elegir a mano.';
