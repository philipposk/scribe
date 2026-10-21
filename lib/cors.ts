import { getCorsAllowedOrigins } from "@/lib/config";

export function corsHeadersForRequest(
  requestOrigin: string | null,
  allowedOrigins: string[] = getCorsAllowedOrigins(),
): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
  };

  if (allowedOrigins.length === 0) {
    return base;
  }

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return {
      ...base,
      "Access-Control-Allow-Origin": requestOrigin,
      Vary: "Origin",
    };
  }

  return base;
}

export function isCorsPreflightAllowed(
  requestOrigin: string | null,
  allowedOrigins: string[] = getCorsAllowedOrigins(),
): boolean {
  if (allowedOrigins.length === 0) return true;
  return Boolean(requestOrigin && allowedOrigins.includes(requestOrigin));
}
