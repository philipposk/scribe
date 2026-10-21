import { estimateDurationSecondsFromBytes } from "@/lib/audio-duration";
import { GROQ_USD_PER_HOUR } from "@/lib/cost";
import type {
  TranscribeFailure,
  TranscribeInput,
  TranscribeSuccess,
  TranscriptionEngine,
} from "@/lib/engines/types";

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

function isRateOrServerError(status: number): boolean {
  return status === 429 || status >= 500;
}

export function createGroqEngine(apiKey: string): TranscriptionEngine {
  return {
    id: "groq/whisper-large-v3-turbo",
    usdPerHour: GROQ_USD_PER_HOUR,
    async transcribe(input: TranscribeInput): Promise<TranscribeSuccess | TranscribeFailure> {
      const form = new FormData();
      form.append("file", input.file, input.filename);
      form.append("model", "whisper-large-v3-turbo");
      form.append("language", input.language);
      form.append("response_format", "verbose_json");

      let response: Response;
      try {
        response = await fetch(GROQ_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: form,
        });
      } catch (err) {
        return {
          retryable: true,
          message: err instanceof Error ? err.message : "Groq request failed",
        };
      }

      const bodyText = await response.text();
      if (!response.ok) {
        return {
          retryable: isRateOrServerError(response.status),
          status: response.status,
          message: `Groq error ${response.status}: ${bodyText.slice(0, 500)}`,
        };
      }

      try {
        const data = JSON.parse(bodyText) as {
          text?: string;
          duration?: number;
          segments?: { end?: number }[];
        };
        const text = (data.text ?? "").trim();
        let durationSeconds = data.duration ?? 0;
        if (!durationSeconds && data.segments?.length) {
          const last = data.segments[data.segments.length - 1];
          durationSeconds = last?.end ?? 0;
        }
        if (!durationSeconds && input.file instanceof Blob) {
          durationSeconds = estimateDurationSecondsFromBytes(input.file.size);
        }

        return {
          text,
          durationSeconds,
          engine: "groq/whisper-large-v3-turbo",
          usdPerHour: GROQ_USD_PER_HOUR,
        };
      } catch {
        return {
          retryable: false,
          message: "Groq returned invalid JSON",
        };
      }
    },
  };
}
