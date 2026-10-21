export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const DEFAULT_LANGUAGE = "en";
/** Maximum allowed cost per audio hour (USD) for engine selection. */
export const MAX_COST_USD_PER_HOUR = 0.1;

export type AppId = string;

export function getGroqApiKey(): string | undefined {
  return process.env.GROQ_API_KEY?.trim() || undefined;
}

export function getOpenRouterApiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY?.trim() || undefined;
}

/**
 * Per-app API keys: `SCRIBE_APP_KEYS=sparks:secret1,catchy:secret2`
 * Lookup is by Bearer token value → app id.
 */
export function loadAppKeyIndex(): Map<string, AppId> {
  const raw = process.env.SCRIBE_APP_KEYS?.trim();
  const index = new Map<string, AppId>();
  if (!raw) {
    return index;
  }
  for (const part of raw.split(",")) {
    const segment = part.trim();
    if (!segment) continue;
    const colon = segment.indexOf(":");
    if (colon <= 0) continue;
    const appId = segment.slice(0, colon).trim();
    const key = segment.slice(colon + 1).trim();
    if (appId && key) {
      index.set(key, appId);
    }
  }
  return index;
}

export function getCorsAllowedOrigins(): string[] {
  const raw = process.env.SCRIBE_CORS_ORIGINS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export function isSupabaseUsageEnabled(): boolean {
  return Boolean(
    process.env.SCRIBE_SUPABASE_URL?.trim() &&
      process.env.SCRIBE_SUPABASE_SERVICE_KEY?.trim(),
  );
}
