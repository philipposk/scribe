/** Groq whisper-large-v3-turbo list price (USD per audio hour). */
export const GROQ_USD_PER_HOUR = 0.04;

/** OpenRouter openai/whisper-large-v3-turbo approximate price (USD per audio hour). */
export const OPENROUTER_USD_PER_HOUR = 0.06;

export function estimateCostUsd(
  durationSeconds: number,
  usdPerHour: number,
): number {
  if (durationSeconds <= 0 || !Number.isFinite(durationSeconds)) {
    return 0;
  }
  const hours = durationSeconds / 3600;
  const cost = hours * usdPerHour;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function isWithinBudget(
  usdPerHour: number,
  maxUsdPerHour: number,
): boolean {
  return usdPerHour <= maxUsdPerHour;
}
