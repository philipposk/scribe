export type TranscribeInput = {
  file: Blob;
  filename: string;
  language: string;
};

export type TranscribeSuccess = {
  text: string;
  durationSeconds: number;
  engine: string;
  usdPerHour: number;
};

export type TranscribeFailure = {
  retryable: boolean;
  message: string;
  status?: number;
};

export interface TranscriptionEngine {
  readonly id: string;
  readonly usdPerHour: number;
  transcribe(input: TranscribeInput): Promise<TranscribeSuccess | TranscribeFailure>;
}

export function isSuccess(
  result: TranscribeSuccess | TranscribeFailure,
): result is TranscribeSuccess {
  return "text" in result;
}
