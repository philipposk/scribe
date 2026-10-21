export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 p-8 font-sans">
      <h1 className="text-2xl font-semibold tracking-tight">Scribe</h1>
      <p className="text-neutral-600">
        Speech-to-text API for Sparks, Catchy, and other apps. Send authenticated
        POST requests to <code className="rounded bg-neutral-100 px-1">/v1/transcribe</code>.
      </p>
      <p className="text-sm text-neutral-500">
        See the repository README for setup, API docs, and deployment on Vercel.
      </p>
    </main>
  );
}
