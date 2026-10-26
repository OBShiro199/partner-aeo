import type { Metadata } from "next";

export const metadata: Metadata = { title: "Strategy Engine", robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
