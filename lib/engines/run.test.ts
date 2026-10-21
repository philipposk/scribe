import { describe, expect, it, vi } from "vitest";
import { transcribeWithFallback } from "@/lib/engines/run";
import type {
  TranscribeFailure,
  TranscribeInput,
  TranscribeSuccess,
  TranscriptionEngine,
} from "@/lib/engines/types";

function mockEngine(
  id: string,
  impl: (input: TranscribeInput) => Promise<TranscribeSuccess | TranscribeFailure>,
): TranscriptionEngine {
  return {
    id,
    usdPerHour: 0.04,
    transcribe: impl,
  };
}

describe("transcribeWithFallback", () => {
  const input: TranscribeInput = {
    file: new Blob(["fake-audio"], { type: "audio/webm" }),
    filename: "clip.webm",
    language: "en",
  };

  it("returns first successful engine result", async () => {
    const primary = mockEngine("primary", async () => ({
      retryable: true,
      message: "rate limited",
      status: 429,
    }));
    const fallback = mockEngine("fallback", async () => ({
      text: "hello world",
      durationSeconds: 12,
      engine: "fallback/test",
      usdPerHour: 0.04,
    }));

    const result = await transcribeWithFallback(input, [primary, fallback]);
    expect(result).toMatchObject({
      text: "hello world",
      language: "en",
      durationSeconds: 12,
      engine: "fallback/test",
    });
  });

  it("fails when all engines fail", async () => {
    const engines = [
      mockEngine("a", async () => ({ retryable: true, message: "down" })),
      mockEngine("b", async () => ({ retryable: true, status: 503, message: "also down" })),
    ];
    const result = await transcribeWithFallback(input, engines);
    expect(result).toMatchObject({ status: 502 });
    expect((result as { message: string }).message).toContain("All engines failed");
  });

  it("does not fall back on a non-retryable 4xx (bad audio)", async () => {
    const fallback = vi.fn(async () => ({
      text: "should not run",
      durationSeconds: 1,
      engine: "b",
      usdPerHour: 0.04,
    }));
    const engines = [
      mockEngine("a", async () => ({ retryable: false, status: 400, message: "bad audio" })),
      mockEngine("b", fallback),
    ];
    const result = await transcribeWithFallback(input, engines);
    expect(result).toMatchObject({ status: 422 });
    expect(fallback).not.toHaveBeenCalled();
  });

  it("calls Groq then OpenRouter when Groq fetch fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("error", { status: 429, statusText: "Too Many Requests" }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ text: "from openrouter" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const groqKey = "groq-test";
    const orKey = "or-test";
    const { buildDefaultEngines } = await import("@/lib/engines/run");
    const engines = buildDefaultEngines({
      groqApiKey: groqKey,
      openRouterApiKey: orKey,
    });

    const integration = await transcribeWithFallback(input, engines);
    expect(integration).toMatchObject({
      text: "from openrouter",
      engine: "openrouter/openai/whisper-large-v3-turbo",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.groq.com/openai/v1/audio/transcriptions",
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://openrouter.ai/api/v1/audio/transcriptions",
    );

    vi.unstubAllGlobals();
  });

  it("skips engines priced above the $0.10/hour cost guard", async () => {
    const pricey = vi.fn(async () => ({ text: "x", durationSeconds: 1, engine: "pricey", usdPerHour: 0.5 }));
    const engines: TranscriptionEngine[] = [{ id: "pricey", usdPerHour: 0.5, transcribe: pricey }];
    const result = await transcribeWithFallback(input, engines);
    expect(result).toMatchObject({ status: 502 });
    expect(pricey).not.toHaveBeenCalled();
  });
});
