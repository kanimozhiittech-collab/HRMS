"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Asterisk } from "lucide-react";
import Sidebar, { SidebarCounts } from "@/components/Sidebar";
import { api, getToken } from "@/lib/api";
import type { Dashboard, Notification } from "@/lib/types";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [counts, setCounts] = useState<SidebarCounts>({
    pending: 0,
    tickets: 0,
    expiring: 0,
    unread: 0,
  });

  useEffect(() => {
    if (!getToken()) router.replace("/login");
    else setReady(true);
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const [dash, unread] = await Promise.all([
          api<Dashboard>("/dashboard"),
          api<Notification[]>("/notifications?unread_only=true"),
        ]);
        setCounts({
          pending: dash.pending_companies,
          tickets: dash.open_tickets,
          expiring: dash.expiring_soon.length,
          unread: unread.length,
        });
      } catch {
        /* badges are best-effort; pages surface their own errors */
      }
    })();
  }, [ready, pathname]);

  // Close drawer on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (!ready) return null;

  return (
    <div className="flex h-screen flex-col bg-stone-300 md:flex-row md:gap-3 md:p-3">
      {/* Mobile top bar */}
      <header className="flex shrink-0 items-center gap-3 bg-stone-900 px-4 py-3 md:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-800 hover:text-white"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2 text-white">
          <Asterisk size={20} strokeWidth={2.5} />
          <span className="text-sm font-semibold tracking-wide">NYGROW HRM</span>
        </div>
      </header>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — always visible on desktop, drawer on mobile */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex transition-transform duration-300 md:relative md:inset-auto md:z-auto md:translate-x-0 md:transition-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:flex`}
      >
        <Sidebar counts={counts} onClose={() => setSidebarOpen(false)} />
      </div>

      <main className="flex-1 overflow-y-auto bg-stone-50 p-4 md:rounded-3xl md:p-8 md:shadow-sm">
        {children}
      </main>
    </div>
  );
}
