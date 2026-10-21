/**
 * Rough duration estimate when the transcription API does not return duration.
 * Opus voice webm is often ~24–32 kbps; we use 28 kbps as a middle estimate.
 */
export function estimateDurationSecondsFromBytes(
  bytes: number,
  assumedBitrateKbps = 28,
): number {
  if (bytes <= 0) return 0;
  const bits = bytes * 8;
  const bps = assumedBitrateKbps * 1000;
  return Math.round((bits / bps) * 10) / 10;
}
