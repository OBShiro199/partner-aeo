import { Gate } from "@/components/gate";
import { Sidebar } from "@/components/shell/Sidebar";
import { AddClientDialog } from "@/components/AddClientDialog";
import { Toasts } from "@/components/ui";
import { GrowthLoader } from "@/components/growth/GrowthLoader";
import { CommandPalette } from "@/components/CommandPalette";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Gate need="ready">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] btn btn-primary">Skip to content</a>
      <div className="flex min-h-dvh">
        <Sidebar />
        <main id="main" tabIndex={-1} className="flex-1 min-w-0 flex flex-col outline-none">{children}</main>
      </div>
      <AddClientDialog />
      <GrowthLoader />
      <CommandPalette />
      <Toasts />
    </Gate>
  );
}
