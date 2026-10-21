import Link from "next/link";
import { Wordmark } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh flex flex-col">
      <div className="absolute inset-0 grid-bg grid-fade" aria-hidden />
      <header className="relative h-14 flex items-center px-5">
        <Link href="/"><Wordmark /></Link>
      </header>
      <main className="relative flex-1 grid place-items-center px-4 pb-16">{children}</main>
    </div>
  );
}
