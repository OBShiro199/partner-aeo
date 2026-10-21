import type { ReactNode } from "react";

// 48px page toolbar. No page titles bar above it; this is the top of every screen.
export function Toolbar({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="sticky top-0 z-[92] h-[48px] flex-none hair-b bg-surface/95 backdrop-blur flex items-center gap-3 px-4 md:px-6">
      <div className="flex items-center gap-3 min-w-0 flex-1">{children}</div>
      {right && <div className="flex items-center gap-2 flex-none">{right}</div>}
    </div>
  );
}

export function Crumb({ children }: { children: ReactNode }) {
  return <span className="text-ink font-medium truncate">{children}</span>;
}
