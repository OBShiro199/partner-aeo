import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

const DESCRIPTION = "Track how ChatGPT, Gemini, Claude and Perplexity recommend every client you manage. One workspace, every client, every engine.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://partneraeo.com"),
  title: { default: "Partner AEO · AI visibility for agencies", template: "%s · Partner AEO" },
  description: DESCRIPTION,
  applicationName: "Partner AEO",
  openGraph: { type: "website", siteName: "Partner AEO", title: "Partner AEO · AI visibility for agencies", description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: "Partner AEO · AI visibility for agencies", description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#ffffff", colorScheme: "light" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
