import { isSupabaseUsageEnabled } from "@/lib/config";

export type UsageRecord = {
  appId: string;
  engine: string;
  durationSeconds: number;
  costUsdEstimate: number;
  language: string;
  bytes: number;
  timestamp: string;
};

export async function logUsage(record: UsageRecord): Promise<void> {
  const line = JSON.stringify({ type: "scribe_usage", ...record });
  console.log(line);

  if (!isSupabaseUsageEnabled()) {
    return;
  }

  const url = process.env.SCRIBE_SUPABASE_URL!.trim();
  const key = process.env.SCRIBE_SUPABASE_SERVICE_KEY!.trim();

  try {
    const res = await fetch(`${url}/rest/v1/scribe_usage`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        app_id: record.appId,
        engine: record.engine,
        duration_seconds: record.durationSeconds,
        cost_usd_estimate: record.costUsdEstimate,
        language: record.language,
        audio_bytes: record.bytes,
        created_at: record.timestamp,
      }),
    });
    if (!res.ok) {
      console.error(
        JSON.stringify({ type: "scribe_usage_error", status: res.status }),
      );
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        type: "scribe_usage_error",
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
