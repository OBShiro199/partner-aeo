import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Partner AEO · AI visibility for agencies",
  description: "Track how ChatGPT, Gemini, Claude and Perplexity recommend every client you manage. One workspace, every client, every engine.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
