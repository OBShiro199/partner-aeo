export const pct = (v: number | null | undefined, digits = 0) =>
  v == null ? "–" : `${(v * 100).toFixed(digits)}%`;

export const num = (v: number | null | undefined) => (v == null ? "–" : v.toLocaleString("en-GB"));

export const score = (v: number | null | undefined) => (v == null ? "–" : Math.round(v).toString());

export const usd = (v: number, digits = 2) =>
  `$${v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 4) })}`;

export const plural = (n: number, one: string, many = one + "s") => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

export function ago(iso: string | null | undefined) {
  if (!iso) return "Never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function normaliseDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  if (!/^https?:\/\//.test(s)) s = "https://" + s;
  try {
    const host = new URL(s).hostname.replace(/^www\./, "");
    return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

export const faviconFor = (domain: string, size = 64) => `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;

export function nameFromDomain(domain: string) {
  const root = domain.split(".")[0];
  return root.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export const INTENT_LABEL: Record<string, string> = {
  best_for: "Best for",
  problem: "Problem",
  comparison: "Comparison",
  local: "Local",
  other: "Brand",
};

export const INTENT_TAG: Record<string, string> = {
  best_for: "tag-blue",
  problem: "tag-violet",
  comparison: "tag-amber",
  local: "tag-teal",
  other: "tag-rose",
};
