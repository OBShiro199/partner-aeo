import { ENGINE_PATHS } from "./engine-paths";

export type EngineId =
  | "chatgpt" | "claude" | "gemini" | "perplexity" | "google_aio"
  | "deepseek" | "grok" | "copilot" | "meta" | "mistral";

export type Engine = {
  id: EngineId;
  name: string;
  short: string;
  maker: string;
  icon: string;          // key into ENGINE_PATHS, or "copilot"
  color: string;
  live: boolean;         // tracked through DataForSEO today
  note?: string;
};

// Order matters: it's the order shown everywhere.
export const ENGINES: Engine[] = [
  { id: "chatgpt", name: "ChatGPT", short: "GPT", maker: "OpenAI", icon: "chatgpt", color: "#10a37f", live: true },
  { id: "gemini", name: "Gemini", short: "Gemini", maker: "Google", icon: "gemini", color: "#8e75b2", live: true },
  { id: "claude", name: "Claude", short: "Claude", maker: "Anthropic", icon: "claude", color: "#d97757", live: true },
  { id: "perplexity", name: "Perplexity", short: "Pplx", maker: "Perplexity", icon: "perplexity", color: "#1fb8cd", live: true },
  { id: "google_aio", name: "AI Overviews", short: "AIO", maker: "Google Search", icon: "google", color: "#4285f4", live: false, note: "Via DataForSEO SERP API" },
  { id: "deepseek", name: "DeepSeek", short: "DeepSeek", maker: "DeepSeek", icon: "deepseek", color: "#4d6bfe", live: false },
  { id: "grok", name: "Grok", short: "Grok", maker: "xAI", icon: "grok", color: "#08090a", live: false },
  { id: "copilot", name: "Copilot", short: "Copilot", maker: "Microsoft", icon: "copilot", color: "#0078d4", live: false },
  { id: "meta", name: "Meta AI", short: "Meta", maker: "Meta", icon: "meta", color: "#0467df", live: false },
  { id: "mistral", name: "Le Chat", short: "Mistral", maker: "Mistral AI", icon: "mistral", color: "#fa520f", live: false },
];

export const MAX_ENGINES = 10;
export const engineById = (id: string) => ENGINES.find((e) => e.id === id);
export const liveEngineIds = (ids: string[]) => ids.filter((id) => engineById(id)?.live);

export function EngineLogo({ id, size = 16, mono = false, className }: { id: string; size?: number; mono?: boolean; className?: string }) {
  const e = engineById(id);
  if (!e) return null;
  const fill = mono ? "currentColor" : e.color;
  if (e.icon === "copilot") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className}>
        <path d="M7.5 4h6.2c1.6 0 2.7 1 3.1 2.4l.5 1.8H12c-1.6 0-2.7 1-3.1 2.4L6.6 18.6C6.2 20 5 21 3.5 21 2 21 1.6 19.7 2.1 18.3L4.4 6.4C4.8 5 6 4 7.5 4Z" fill={fill} opacity="0.9" />
        <path d="M16.5 20h-6.2c-1.6 0-2.7-1-3.1-2.4l-.5-1.8H12c1.6 0 2.7-1 3.1-2.4l2.3-7.9C17.8 4 19 3 20.5 3 22 3 22.4 4.3 21.9 5.7l-2.3 11.9C19.2 19 18 20 16.5 20Z" fill={fill} opacity="0.6" />
      </svg>
    );
  }
  const p = ENGINE_PATHS[e.icon];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className}>
      <path d={p.path} fill={fill} />
    </svg>
  );
}
