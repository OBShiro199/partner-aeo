import type { Metadata } from "next";

// Embedded on agency websites: no Partner AEO branding, never indexed.
export const metadata: Metadata = {
  title: "AI search scanner",
  description: "See how AI assistants answer questions about your business.",
  robots: { index: false, follow: false },
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-surface min-h-0">{children}</div>;
}
