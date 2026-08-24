"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, TrendingUp } from "lucide-react";
import { api, daysLeft, fmtDate, fmtMoney } from "@/lib/api";
import type { Company, Dashboard, Plan } from "@/lib/types";
import {
  Card,
  ErrorNote,
  PageHeader,
  StatusBadge,
  Table,
  Td,
} from "@/components/ui";

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [companies, setCompanies] = useState<Map<number, Company>>(new Map());
  const [plans, setPlans] = useState<Map<number, Plan>>(new Map());
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [dash, comps, planList] = await Promise.all([
          api<Dashboard>("/dashboard"),
          api<Company[]>("/companies"),
          api<Plan[]>("/plans"),
        ]);
        setData(dash);
        setCompanies(new Map(comps.map((c) => [c.id, c])));
        setPlans(new Map(planList.map((p) => [p.id, p])));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
  }, []);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <p className="text-sm text-stone-400">Loading…</p>;

  const kpis = [
    { label: "Active Companies", value: data.active_companies },
    { label: "Pending Approvals", value: data.pending_companies },
    { label: "Suspended", value: data.suspended_companies },
    { label: "Platform Users", value: data.total_users },
    { label: "Open Tickets", value: data.open_tickets },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="All your companies, subscriptions and revenue in one place"
      />

      {/* Hero cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card>
          <p className="text-sm font-medium text-stone-500">Total Companies</p>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-4xl font-semibold tracking-tight text-stone-900 md:text-6xl">
              {data.total_companies}
            </span>
            <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
              <TrendingUp size={12} /> {data.active_companies} active
            </span>
          </div>
          <Link
            href="/companies"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"
          >
            See all companies <ArrowRight size={14} />
          </Link>
        </Card>
        <Card>
          <p className="text-sm font-medium text-stone-500">
            Revenue This Month
          </p>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-4xl font-semibold tracking-tight text-stone-900 md:text-6xl">
              {fmtMoney(data.monthly_revenue)}
            </span>
          </div>
          <Link
            href="/reports"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"
          >
            See report <ArrowRight size={14} />
          </Link>
        </Card>
      </div>

      {/* KPI row */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label} className="!p-4">
            <p className="text-xs font-medium text-stone-500">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold text-stone-900">
              {k.value}
            </p>
          </Card>
        ))}
      </div>

      {/* Expiring soon */}
      <h2 className="mb-3 text-lg font-semibold text-stone-900">
        Subscriptions Expiring Soon
      </h2>
      <Table
        headers={["Company", "Plan", "Start", "End", "Days Left", "Status"]}
        empty={data.expiring_soon.length === 0}
      >
        {data.expiring_soon.map((sub) => (
          <tr key={sub.id}>
            <Td className="font-medium text-stone-900">
              {companies.get(sub.company_id)?.company_name ??
                `Company #${sub.company_id}`}
            </Td>
            <Td>{plans.get(sub.plan_id)?.plan_name ?? `Plan #${sub.plan_id}`}</Td>
            <Td>{fmtDate(sub.start_date)}</Td>
            <Td>{fmtDate(sub.end_date)}</Td>
            <Td
              className={
                daysLeft(sub.end_date) <= 3
                  ? "font-semibold text-red-600"
                  : "font-medium text-amber-600"
              }
            >
              {daysLeft(sub.end_date)} days
            </Td>
            <Td>
              <StatusBadge status={sub.status} />
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
