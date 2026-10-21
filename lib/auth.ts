import { loadAppKeyIndex, type AppId } from "@/lib/config";

export type AuthResult =
  | { ok: true; appId: AppId }
  | { ok: false; status: number; message: string };

export function authenticateBearer(
  authorizationHeader: string | null,
  keyIndex: Map<string, AppId> = loadAppKeyIndex(),
): AuthResult {
  if (keyIndex.size === 0) {
    return {
      ok: false,
      status: 503,
      message: "Service not configured: SCRIBE_APP_KEYS is empty",
    };
  }

  if (!authorizationHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, message: "Missing or invalid Authorization header" };
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (!token) {
    return { ok: false, status: 401, message: "Missing bearer token" };
  }

  const appId = keyIndex.get(token);
  if (!appId) {
    return { ok: false, status: 403, message: "Invalid API key" };
  }

  return { ok: true, appId };
}
