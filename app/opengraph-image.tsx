import { ImageResponse } from "next/og";

export const alt = "Partner AEO: AI visibility for agencies";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Grid paper, the answer-ring mark and one line: the same quiet look as the product.
export default function OgImage() {
  const lines = Array.from({ length: 21 }, (_, i) => i * 60);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#ffffff", fontFamily: "sans-serif" }}>
        {lines.map((x) => <div key={`v${x}`} style={{ position: "absolute", left: x, top: 0, width: 1, height: 630, background: "#f0f0f2" }} />)}
        {lines.slice(0, 11).map((y) => <div key={`h${y}`} style={{ position: "absolute", top: y, left: 0, height: 1, width: 1200, background: "#f0f0f2" }} />)}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 96px", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
              <rect x="0.5" y="0.5" width="23" height="23" rx="6" fill="#fff" stroke="#dcdde0" />
              <circle cx="12" cy="12" r="6.25" stroke="#08090a" strokeWidth="1.5" />
              <path d="M12 5.75a6.25 6.25 0 0 1 6.25 6.25" stroke="#5f86e0" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="18.25" cy="12" r="1.9" fill="#5f86e0" />
            </svg>
            <span style={{ fontSize: 34, color: "#08090a", fontWeight: 600 }}>Partner AEO</span>
          </div>
          <div style={{ fontSize: 72, lineHeight: 1.05, letterSpacing: -2.5, color: "#08090a", fontWeight: 600, marginTop: 48, maxWidth: 900 }}>
            See how AI recommends every client you manage.
          </div>
          <div style={{ fontSize: 30, color: "#62666d", marginTop: 28 }}>ChatGPT · Perplexity · Gemini · Claude, in one agency workspace.</div>
        </div>
      </div>
    ),
    size,
  );
}
