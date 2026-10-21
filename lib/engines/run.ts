import { MAX_COST_USD_PER_HOUR } from "@/lib/config";
import {
  estimateCostUsd,
  GROQ_USD_PER_HOUR,
  OPENROUTER_USD_PER_HOUR,
  isWithinBudget,
} from "@/lib/cost";
import { createGroqEngine } from "@/lib/engines/groq";
import { createOpenRouterEngine } from "@/lib/engines/openrouter";
import type {
  TranscribeFailure,
  TranscribeInput,
  TranscriptionEngine,
} from "@/lib/engines/types";
import { isSuccess } from "@/lib/engines/types";

export type TranscribeResponse = {
  text: string;
  language: string;
  durationSeconds: number;
  engine: string;
  costUsdEstimate: number;
};

export type TranscribeRunError = {
  status: number;
  message: string;
};

export function isRunError(
  result: TranscribeResponse | TranscribeRunError,
): result is TranscribeRunError {
  return !("text" in result);
}

export function buildDefaultEngines(options: {
  groqApiKey?: string;
  openRouterApiKey?: string;
}): TranscriptionEngine[] {
  const engines: TranscriptionEngine[] = [];
  if (options.groqApiKey && isWithinBudget(GROQ_USD_PER_HOUR, MAX_COST_USD_PER_HOUR)) {
    engines.push(createGroqEngine(options.groqApiKey));
  }
  if (
    options.openRouterApiKey &&
    isWithinBudget(OPENROUTER_USD_PER_HOUR, MAX_COST_USD_PER_HOUR)
  ) {
    engines.push(createOpenRouterEngine(options.openRouterApiKey));
  }
  return engines;
}

export async function transcribeWithFallback(
  input: TranscribeInput,
  engines: TranscriptionEngine[],
): Promise<TranscribeResponse | TranscribeRunError> {
  if (engines.length === 0) {
    return {
      status: 503,
      message: "No transcription engines configured or all exceed cost budget",
    };
  }

  const errors: string[] = [];

  for (const engine of engines) {
    if (!isWithinBudget(engine.usdPerHour, MAX_COST_USD_PER_HOUR)) {
      continue;
    }

    const result = await engine.transcribe(input);
    if (isSuccess(result)) {
      return {
        text: result.text,
        language: input.language,
        durationSeconds: result.durationSeconds,
        engine: result.engine,
        costUsdEstimate: estimateCostUsd(result.durationSeconds, result.usdPerHour),
      };
    }

    const failure = result as TranscribeFailure;
    errors.push(`${engine.id}: ${failure.message}`);
    if (!failure.retryable) {
      // Client-side problems (bad audio, 4xx) won't be fixed by another engine; only fall back on 429/5xx/network.
      return {
        status: failure.status && failure.status >= 400 && failure.status < 500 ? 422 : 502,
        message: `Transcription failed. ${errors.join(" | ")}`,
      };
    }
  }

  return {
    status: 502,
    message: `All engines failed. ${errors.join(" | ")}`,
  };
}
