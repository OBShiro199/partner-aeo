import Link from "next/link";
import { Wordmark } from "@/components/brand";

export default function NotFound() {
  return (
    <main className="relative min-h-dvh grid place-items-center px-6 overflow-hidden">
      <div className="absolute inset-0 grid-bg grid-fade opacity-80" aria-hidden />
      <div className="relative max-w-[380px] text-center flex flex-col items-center gap-3">
        <Wordmark />
        <p className="text-faint tnum mt-6">404</p>
        <h1 className="h2">This page isn&apos;t here</h1>
        <p className="text-muted">The link may be old, or the page moved. Your data is safe.</p>
        <div className="flex gap-2 mt-3">
          <Link href="/dashboard" className="btn btn-primary">Go to dashboard</Link>
          <Link href="/" className="btn btn-ghost">Home</Link>
        </div>
      </div>
    </main>
  );
}
