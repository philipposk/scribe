import { authenticateBearer } from "@/lib/auth";
import { corsHeadersForRequest, isCorsPreflightAllowed } from "@/lib/cors";
import {
  DEFAULT_LANGUAGE,
  getGroqApiKey,
  getOpenRouterApiKey,
  MAX_AUDIO_BYTES,
} from "@/lib/config";
import { buildDefaultEngines, isRunError, transcribeWithFallback } from "@/lib/engines/run";
import { logUsage } from "@/lib/usage";

export const maxDuration = 120;

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

export async function OPTIONS(request: Request): Promise<Response> {
  const origin = request.headers.get("Origin");
  const cors = corsHeadersForRequest(origin);
  if (!isCorsPreflightAllowed(origin)) {
    return new Response(null, { status: 403, headers: cors });
  }
  return new Response(null, { status: 204, headers: cors });
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("Origin");
  const cors = corsHeadersForRequest(origin);

  if (origin && !isCorsPreflightAllowed(origin)) {
    return jsonResponse({ error: "Origin not allowed" }, 403, cors);
  }

  const auth = authenticateBearer(request.headers.get("Authorization"));
  if (!auth.ok) {
    return jsonResponse({ error: auth.message }, auth.status, cors);
  }

  // Reject oversized uploads before buffering the multipart body into memory.
  const declaredLength = Number(request.headers.get("Content-Length") ?? 0);
  if (declaredLength > MAX_AUDIO_BYTES + 64 * 1024) {
    return jsonResponse(
      { error: `File exceeds maximum size of ${MAX_AUDIO_BYTES} bytes` },
      413,
      cors,
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ error: "Invalid multipart body" }, 400, cors);
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return jsonResponse({ error: "Missing file field" }, 400, cors);
  }

  const size = file.size;
  if (size <= 0) {
    return jsonResponse({ error: "Empty audio file" }, 400, cors);
  }
  if (size > MAX_AUDIO_BYTES) {
    return jsonResponse(
      { error: `File exceeds maximum size of ${MAX_AUDIO_BYTES} bytes` },
      413,
      cors,
    );
  }

  const languageRaw = formData.get("language");
  const language =
    typeof languageRaw === "string" && /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(languageRaw.trim())
      ? languageRaw.trim()
      : DEFAULT_LANGUAGE;

  const filename =
    file instanceof File && file.name ? file.name : "audio.webm";

  const engines = buildDefaultEngines({
    groqApiKey: getGroqApiKey(),
    openRouterApiKey: getOpenRouterApiKey(),
  });

  const result = await transcribeWithFallback(
    { file, filename, language },
    engines,
  );

  if (isRunError(result)) {
    return jsonResponse({ error: result.message }, result.status, cors);
  }
  const success = result;

  await logUsage({
    appId: auth.appId,
    engine: success.engine,
    durationSeconds: success.durationSeconds,
    costUsdEstimate: success.costUsdEstimate,
    language: success.language,
    bytes: size,
    timestamp: new Date().toISOString(),
  });

  return jsonResponse(success, 200, cors);
}
