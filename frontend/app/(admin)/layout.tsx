"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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

  if (!ready) return null;

  return (
    <div className="flex h-screen gap-3 bg-stone-300 p-3">
      <Sidebar counts={counts} />
      <main className="flex-1 overflow-y-auto rounded-3xl bg-stone-50 p-8 shadow-sm">
        {children}
      </main>
    </div>
  );
}
