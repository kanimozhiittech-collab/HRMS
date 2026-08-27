"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeCheck,
  BarChart3,
  Bell,
  Building2,
  CalendarClock,
  ChevronDown,
  CreditCard,
  Hourglass,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  LogOut,
  ScrollText,
  Settings,
  UsersRound,
  X,
} from "lucide-react";
import { clearSession } from "@/lib/api";

export type SidebarCounts = {
  pending: number;
  tickets: number;
  expiring: number;
  unread: number;
};

function menuGroups(counts: SidebarCounts) {
  return [
    {
      label: "Main",
      items: [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/companies", label: "Companies", icon: Building2 },
        { href: "/plans", label: "Plans", icon: Layers },
        {
          href: "/subscriptions",
          label: "Subscriptions",
          icon: CalendarClock,
        },
        { href: "/users", label: "Platform Users", icon: UsersRound },
      ],
    },
    {
      label: "Status",
      items: [
        {
          href: "/companies?status=pending",
          label: "Pending Approvals",
          icon: BadgeCheck,
          badge: counts.pending,
        },
        {
          href: "/tickets",
          label: "Support Tickets",
          icon: LifeBuoy,
          badge: counts.tickets,
        },
        {
          href: "/subscriptions?expiring=1",
          label: "Expiring Soon",
          icon: Hourglass,
          badge: counts.expiring,
        },
        {
          href: "/notifications",
          label: "Notifications",
          icon: Bell,
          badge: counts.unread,
        },
      ],
    },
    {
      label: "Billing",
      items: [
        { href: "/payments", label: "Payments & Invoices", icon: CreditCard },
        { href: "/reports", label: "Reports", icon: BarChart3 },
      ],
    },
    {
      label: "System",
      items: [
        { href: "/audit-logs", label: "Audit Logs", icon: ScrollText },
        { href: "/settings", label: "Global Settings", icon: Settings },
      ],
    },
  ];
}

export default function Sidebar({
  counts,
  onClose,
}: {
  counts: SidebarCounts;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = () => {
    clearSession();
    router.replace("/login");
  };

  return (
    <>
      {/* Light menu panel */}
      <aside className="flex w-72 shrink-0 flex-col overflow-y-auto rounded-3xl border-r border-stone-200 bg-stone-100 p-5">
        {/* Brand */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="NYGROW Digital Pvt. Ltd."
              className="h-9 w-auto"
            />
            <div className="flex items-center gap-1">
              <button
                onClick={logout}
                title="Logout"
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700"
              >
                <LogOut size={16} />
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  title="Close menu"
                  className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700 md:hidden"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-stone-500">
            NYGROW HRM
            <ChevronDown size={12} className="text-stone-400" />
          </p>
        </div>

        {/* Groups */}
        <nav className="flex flex-col gap-6">
          {menuGroups(counts).map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-2 text-xs font-medium text-stone-400">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const base = item.href.split("?")[0];
                  const active =
                    pathname === base && !item.href.includes("?");
                  const badge = "badge" in item ? (item.badge as number) : null;
                  return (
                    <Link
                      key={item.href + item.label}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-white font-medium text-indigo-700 shadow-sm ring-1 ring-stone-200"
                          : "text-stone-600 hover:bg-stone-200/60"
                      }`}
                    >
                      <item.icon
                        size={17}
                        className={`shrink-0 ${active ? "text-indigo-600" : "text-stone-500"}`}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {badge !== null && badge > 0 && (
                        <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600">
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
