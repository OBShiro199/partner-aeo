"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SquaresFour, UsersThree, CreditCard, GearSix, Plus, CaretUpDown, SignOut, Flask } from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { isDemo } from "@/lib/repo";
import { cx, Favicon, Menu } from "../ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: SquaresFour, tour: "nav-dashboard" },
  { href: "/clients", label: "Clients", Icon: UsersThree, tour: "nav-clients" },
  { href: "/lab", label: "API lab", Icon: Flask, tour: "nav-lab" },
  { href: "/billing", label: "Billing", Icon: CreditCard, tour: "nav-billing" },
  { href: "/settings", label: "Settings", Icon: GearSix, tour: "nav-settings" },
];

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const agency = useApp((s) => s.agency)!;
  const user = useApp((s) => s.user);
  const clients = useApp((s) => s.clients);
  const filterClient = useApp((s) => s.filterClient);
  const setFilterClient = useApp((s) => s.setFilterClient);
  const openAdd = useApp((s) => s.setAddClientOpen);
  const signOut = useApp((s) => s.signOut);

  return (
    <aside className="sticky top-0 h-dvh w-[56px] min-[1100px]:w-[240px] flex-none hair-r bg-surface flex flex-col z-[90]">
      {/* Agency identity */}
      <div className="h-[48px] flex items-center px-2 min-[1100px]:px-3 hair-b">
        <Menu
          width={232}
          trigger={(p) => (
            <button {...p} className="w-full flex items-center gap-2.5 h-8 px-1.5 rounded-md hover:bg-hover transition-colors text-left" data-tour="agency">
              <Favicon src={agency.favicon_url} domain={agency.domain} name={agency.name} size={22} />
              <span className="hidden min-[1100px]:block flex-1 truncate font-medium text-ink">{agency.name}</span>
              <CaretUpDown size={14} className="hidden min-[1100px]:block text-faint" />
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="px-2 py-2 hair-b mb-1">
                <p className="text-ink font-medium truncate">{agency.name}</p>
                <p className="text-faint truncate">{user?.email}</p>
              </div>
              <button className="menu-item" onClick={() => { close(); router.push("/settings"); }}><GearSix size={16} /> Agency settings</button>
              <button className="menu-item" onClick={() => { close(); router.push("/billing"); }}><CreditCard size={16} /> Plan and billing</button>
              <button className="menu-item" onClick={async () => { close(); await signOut(); router.replace("/login"); }}><SignOut size={16} /> Log out</button>
            </>
          )}
        </Menu>
      </div>

      {/* Add client */}
      <div className="p-2 min-[1100px]:p-3">
        <button
          data-tour="add-client"
          onClick={() => openAdd(true)}
          className="btn btn-primary w-full px-0 min-[1100px]:px-3 justify-center min-[1100px]:justify-start"
          aria-label="Add client"
        >
          <Plus size={15} weight="bold" className="text-blue" />
          <span className="hidden min-[1100px]:inline">Add client</span>
          <span className="hidden min-[1100px]:inline ml-auto text-faint font-normal tnum">{clients.length}/{agency.client_limit}</span>
        </button>
      </div>

      <nav className="px-2 min-[1100px]:px-3 flex flex-col gap-0.5" aria-label="Main">
        {NAV.map(({ href, label, Icon, tour }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              data-tour={tour}
              aria-current={active ? "page" : undefined}
              className={cx(
                "h-8 flex items-center gap-2.5 px-2 rounded-md transition-colors justify-center min-[1100px]:justify-start",
                active ? "bg-blue-soft text-ink font-medium" : "text-muted hover:bg-hover hover:text-ink",
              )}
            >
              <Icon size={17} weight={active ? "duotone" : "regular"} color={active ? "var(--blue)" : undefined} />
              <span className="hidden min-[1100px]:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Client quick filter */}
      <div className="hidden min-[1100px]:flex flex-col min-h-0 flex-1 mt-4">
        <p className="h-7 flex items-center px-5 text-faint">Clients</p>
        <div className="flex-1 overflow-y-auto px-3 pb-3 no-scrollbar">
          <button
            onClick={() => { setFilterClient(null); router.push("/dashboard"); }}
            className={cx("w-full h-8 flex items-center gap-2.5 px-2 rounded-md text-left transition-colors", filterClient === null && path === "/dashboard" ? "text-ink font-medium bg-hover" : "text-muted hover:bg-hover hover:text-ink")}
          >
            <span className="size-[18px] grid place-items-center rounded-[4px] border border-dashed border-btn-edge text-[10px] text-faint">∗</span>
            All clients
          </button>
          {clients.map((c) => (
            <button
              key={c.id}
              onClick={() => { setFilterClient(c.id); router.push("/dashboard"); }}
              className={cx("w-full h-8 flex items-center gap-2.5 px-2 rounded-md text-left transition-colors", filterClient === c.id && path === "/dashboard" ? "text-ink font-medium bg-hover" : "text-muted hover:bg-hover hover:text-ink")}
            >
              <Favicon src={c.favicon_url} domain={c.domain} name={c.name} size={18} />
              <span className="truncate">{c.name}</span>
            </button>
          ))}
          {!clients.length && <p className="px-2 text-ghost">No clients yet</p>}
        </div>
      </div>

      <div className="mt-auto hair-t p-2 min-[1100px]:p-3">
        {isDemo ? (
          <div className="hidden min-[1100px]:flex items-center gap-2 text-faint">
            <span className="tag tag-amber">Demo</span> Sample data, nothing is billed
          </div>
        ) : (
          <div className="hidden min-[1100px]:flex items-center gap-2 text-faint truncate">{user?.email}</div>
        )}
      </div>
    </aside>
  );
}
