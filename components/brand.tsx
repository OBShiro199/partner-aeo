import { cx } from "@/lib/cx";

// Partner AEO mark: an answer ring with a live point.
export function Mark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <rect x="0.5" y="0.5" width="23" height="23" rx="6" fill="#fff" stroke="#dcdde0" />
      <circle cx="12" cy="12" r="6.25" stroke="#08090a" strokeWidth="1.5" />
      <path d="M12 5.75a6.25 6.25 0 0 1 6.25 6.25" stroke="#5f86e0" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="18.25" cy="12" r="1.9" fill="#5f86e0" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 text-ink font-medium t-14", className)}>
      <Mark />
      Partner AEO
    </span>
  );
}
