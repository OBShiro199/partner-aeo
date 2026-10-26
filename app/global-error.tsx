"use client";
import "./globals.css";

// Last resort when the root layout itself fails. Plain markup: nothing here may depend on app state.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-dvh grid place-items-center px-6" style={{ fontFamily: "system-ui, sans-serif" }}>
        <div className="max-w-[360px] text-center flex flex-col items-center gap-3">
          <h1 className="t-16 font-medium text-ink">Partner AEO hit an error</h1>
          <p className="text-muted">Reload the page. If it keeps happening, email support and we&apos;ll look at it.</p>
          <button className="btn btn-primary mt-2" onClick={() => retry()}>Try again</button>
        </div>
      </body>
    </html>
  );
}
