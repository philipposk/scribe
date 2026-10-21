# Scribe

Standalone speech-to-text HTTP service for **Sparks**, **Catchy**, and other apps. Deploy on Vercel (planned production host: `scribe.6x7.gr`).

## Features

- `POST /v1/transcribe` — multipart audio upload (webm/opus, mp4/m4a, up to 25 MB)
- Engine chain: **Groq** `whisper-large-v3-turbo` → **OpenRouter** `openai/whisper-large-v3-turbo` on retryable errors
- Per-app **Bearer** API keys
- Configurable **CORS** origins
- Usage logging to **stdout** (JSON lines) and optional **Supabase** table

## Quick start

```bash
cp .env.example .env.local
# Fill in GROQ_API_KEY, OPENROUTER_API_KEY, and SCRIBE_APP_KEYS

npm install
npm run dev
```

Dev server runs on port 3000 by default. Use a custom port: `npm run dev -- -p 43123`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | One of Groq/OpenRouter | Groq API key for primary transcription |
| `OPENROUTER_API_KEY` | One of Groq/OpenRouter | Fallback transcription via OpenRouter |
| `SCRIBE_APP_KEYS` | Yes | `appId:secret` pairs, comma-separated (e.g. `sparks:abc,catchy:def`) |
| `SCRIBE_CORS_ORIGINS` | No | Comma-separated allowed `Origin` values for browser clients |
| `SCRIBE_SUPABASE_URL` | No | Supabase project URL for usage persistence |
| `SCRIBE_SUPABASE_SERVICE_KEY` | No | Service role key (server only) |
| `OPENROUTER_HTTP_REFERER` | No | Attribution header for OpenRouter |
| `OPENROUTER_APP_TITLE` | No | App title header for OpenRouter |

## API

### `POST /v1/transcribe`

**Headers**

- `Authorization: Bearer <app-secret>` — secret from `SCRIBE_APP_KEYS` for that app
- `Content-Type: multipart/form-data`

**Form fields**

| Field | Required | Description |
|-------|----------|-------------|
| `file` | Yes | Audio file (e.g. `audio/webm`, `audio/mp4`) |
| `language` | No | ISO language code (default `en`) |

**Response `200`**

```json
{
  "text": "transcribed text",
  "language": "en",
  "durationSeconds": 42.5,
  "engine": "groq/whisper-large-v3-turbo",
  "costUsdEstimate": 0.000472
}
```

**Errors**

- `401` / `403` — missing or invalid API key
- `413` — file larger than 25 MB
- `502` — all engines failed
- `503` — no engines or app keys configured

### Example

```bash
curl -sS -X POST "http://localhost:3000/v1/transcribe" \
  -H "Authorization: Bearer change-me-sparks" \
  -F "file=@recording.webm;type=audio/webm" \
  -F "language=en"
```

### CORS

Browsers must send a permitted `Origin` when `SCRIBE_CORS_ORIGINS` is set. Preflight: `OPTIONS /v1/transcribe`.

## Usage logging

Every successful transcription emits a JSON line on stdout:

```json
{"type":"scribe_usage","appId":"sparks","engine":"groq/whisper-large-v3-turbo","durationSeconds":12,"costUsdEstimate":0.000133,"language":"en","bytes":48000,"timestamp":"2026-10-21T00:00:00.000Z"}
```

On Vercel, these appear in function logs. To store rows in Supabase, run `supabase/scribe_usage.sql`, then set `SCRIBE_SUPABASE_URL` and `SCRIBE_SUPABASE_SERVICE_KEY`.

## Cost notes

Default engine pricing assumptions (USD per audio hour):

| Engine | Rate | Within default $0.10/hr budget |
|--------|------|--------------------------------|
| Groq `whisper-large-v3-turbo` | $0.04/hr | Yes (primary) |
| OpenRouter `openai/whisper-large-v3-turbo` | ~$0.06/hr | Yes (fallback) |

`costUsdEstimate` in the response is `durationSeconds / 3600 * engineRate`. Engines above `MAX_COST_USD_PER_HOUR` (0.10) are not registered. Verify current pricing on [Groq](https://groq.com/pricing) and [OpenRouter](https://openrouter.ai/models) before scaling.

## Tests

```bash
npm test
npm run build
```

## Deploy on Vercel

1. Import this repository in Vercel (Next.js preset).
2. Add environment variables from `.env.example` in the Vercel project settings.
3. Assign custom domain `scribe.6x7.gr` (DNS CNAME to Vercel).
4. Deploy.

**Note:** Large multipart uploads may be subject to Vercel/serverless request size limits on your plan. If uploads near 25 MB fail at the edge, use a smaller clip, upgrade plan limits, or front the API with a storage upload + URL-based flow in a future revision.

## Project layout

- `app/v1/transcribe/route.ts` — HTTP handler
- `lib/engines/` — pluggable transcription engines and fallback runner
- `lib/auth.ts` — Bearer key validation
- `lib/usage.ts` — stdout (+ optional Supabase) usage records

## Tested

Verified locally (Node 20.19, Next 16.4.2) on 2026-10-21:

- `npm install`, `next typegen && tsc --noEmit`, `eslint .`: clean
- `vitest run`: 9/9 pass. Covers auth, fallback on retryable errors, no fallback on 4xx, all-engines-failed, the cost guard skipping engines above $0.10/h, and Groq 429 falling back to OpenRouter.
- `next build`: passes
- Smoke test of `next start` with Groq/OpenRouter mocked at the `fetch` layer:
  - no `Authorization` → 401; wrong key → 403; valid key → 200 from Groq with `costUsdEstimate`
  - missing `file` → 400; 26 MB upload → 413, rejected from `Content-Length` before the body is parsed
  - CORS: an allowed origin's preflight → 204 with `Access-Control-Allow-Origin`; a disallowed origin → 403 on preflight and on POST
  - Groq 429 or 500 → falls back to OpenRouter (200); Groq 400 → 422 with no fallback
  - no engine keys set → 503

Not verified: the real Groq and OpenRouter APIs (including OpenRouter's audio endpoint and response shape), the Supabase usage insert, and a deploy to Vercel.
