import { estimateDurationSecondsFromBytes } from "@/lib/audio-duration";
import { OPENROUTER_USD_PER_HOUR } from "@/lib/cost";
import type {
  TranscribeFailure,
  TranscribeInput,
  TranscribeSuccess,
  TranscriptionEngine,
} from "@/lib/engines/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/audio/transcriptions";

function isRateOrServerError(status: number): boolean {
  return status === 429 || status >= 500;
}

export function createOpenRouterEngine(apiKey: string): TranscriptionEngine {
  return {
    id: "openrouter/openai/whisper-large-v3-turbo",
    usdPerHour: OPENROUTER_USD_PER_HOUR,
    async transcribe(input: TranscribeInput): Promise<TranscribeSuccess | TranscribeFailure> {
      const form = new FormData();
      form.append("file", input.file, input.filename);
      form.append("model", "openai/whisper-large-v3-turbo");
      form.append("language", input.language);

      let response: Response;
      try {
        response = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "https://scribe.6x7.gr",
            "X-Title": process.env.OPENROUTER_APP_TITLE ?? "Scribe",
          },
          body: form,
        });
      } catch (err) {
        return {
          retryable: true,
          message: err instanceof Error ? err.message : "OpenRouter request failed",
        };
      }

      const bodyText = await response.text();
      if (!response.ok) {
        return {
          retryable: isRateOrServerError(response.status),
          status: response.status,
          message: `OpenRouter error ${response.status}: ${bodyText.slice(0, 500)}`,
        };
      }

      try {
        const data = JSON.parse(bodyText) as {
          text?: string;
          usage?: { seconds?: number };
        };
        const text = (data.text ?? "").trim();
        // OpenRouter reports billed audio seconds in usage.seconds; fall back to a size-based estimate.
        const durationSeconds =
          typeof data.usage?.seconds === "number" && data.usage.seconds > 0
            ? data.usage.seconds
            : estimateDurationSecondsFromBytes(input.file.size);

        return {
          text,
          durationSeconds,
          engine: "openrouter/openai/whisper-large-v3-turbo",
          usdPerHour: OPENROUTER_USD_PER_HOUR,
        };
      } catch {
        return {
          retryable: false,
          message: "OpenRouter returned invalid JSON",
        };
      }
    },
  };
}
