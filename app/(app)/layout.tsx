import { Gate } from "@/components/gate";
import { Sidebar } from "@/components/shell/Sidebar";
import { AddClientDialog } from "@/components/AddClientDialog";
import { Toasts } from "@/components/ui";
import { GrowthLoader } from "@/components/growth/GrowthLoader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Gate need="ready">
      <div className="flex min-h-dvh">
        <Sidebar />
        <main className="flex-1 min-w-0 flex flex-col">{children}</main>
      </div>
      <AddClientDialog />
      <GrowthLoader />
      <Toasts />
    </Gate>
  );
}
