"use client";
import { useCallback, useEffect, useState } from "react";
import { api, fmtMoney } from "@/lib/api";
import { Card, ErrorNote, inputCls, PageHeader } from "@/components/ui";

/* Chart palette — validated categorical slots 1–2 (blue, green) */
const BLUE = "#2a78d6";
const GREEN = "#008300";

type RevenueReport = {
  year: number;
  monthly_revenue: { month: string; revenue: number }[];
  total_revenue: number;
};

type CompanyStats = {
  by_status: Record<string, number>;
  by_plan: Record<string, number>;
};

type GrowthReport = {
  year: number;
  new_companies: { month: string; count: number }[];
  new_users: { month: string; count: number }[];
};

function ColumnChart({
  data,
  color,
  format,
}: {
  data: { label: string; value: number }[];
  color: string;
  format: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div>
      <div className="flex h-44 items-end gap-1.5 border-b border-stone-300">
        {data.map((d) => (
          <div
            key={d.label}
            className="group relative flex h-full flex-1 items-end justify-center"
          >
            <span className="pointer-events-none absolute -top-7 z-10 hidden whitespace-nowrap rounded-md bg-stone-900 px-2 py-1 text-xs text-white group-hover:block">
              {d.label}: {format(d.value)}
            </span>
            <div
              className="w-full max-w-8 rounded-t-[4px] transition-opacity group-hover:opacity-80"
              style={{
                height: `${(d.value / max) * 100}%`,
                minHeight: d.value > 0 ? "3px" : "0",
                background: color,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d) => (
          <span
            key={d.label}
            className="flex-1 text-center text-[11px] text-stone-400"
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function GroupedColumnChart({
  months,
  series,
}: {
  months: string[];
  series: { name: string; color: string; values: number[] }[];
}) {
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  return (
    <div>
      <div className="mb-3 flex gap-4">
        {series.map((s) => (
          <span
            key={s.name}
            className="inline-flex items-center gap-1.5 text-xs text-stone-600"
          >
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: s.color }}
            />
            {s.name}
          </span>
        ))}
      </div>
      <div className="flex h-44 items-end gap-1.5 border-b border-stone-300">
        {months.map((m, i) => (
          <div
            key={m}
            className="group relative flex h-full flex-1 items-end justify-center gap-[2px]"
          >
            <span className="pointer-events-none absolute -top-10 z-10 hidden whitespace-nowrap rounded-md bg-stone-900 px-2 py-1 text-xs text-white group-hover:block">
              {m}
              {series.map((s) => (
                <span key={s.name} className="block">
                  {s.name}: {s.values[i]}
                </span>
              ))}
            </span>
            {series.map((s) => (
              <div
                key={s.name}
                className="w-full max-w-4 rounded-t-[4px] transition-opacity group-hover:opacity-80"
                style={{
                  height: `${(s.values[i] / max) * 100}%`,
                  minHeight: s.values[i] > 0 ? "3px" : "0",
                  background: s.color,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {months.map((m) => (
          <span
            key={m}
            className="flex-1 text-center text-[11px] text-stone-400"
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

function HBarList({
  items,
  color,
}: {
  items: { label: string; value: number }[];
  color: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {items.length === 0 && (
        <p className="text-sm text-stone-400">No data</p>
      )}
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3">
          <span className="w-32 truncate text-sm capitalize text-stone-600">
            {i.label.replace("_", " ")}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-r-[4px]"
              style={{ width: `${(i.value / max) * 100}%`, background: color }}
            />
          </div>
          <span className="w-10 text-right text-sm font-medium tabular-nums text-stone-900">
            {i.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [revenue, setRevenue] = useState<RevenueReport | null>(null);
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [growth, setGrowth] = useState<GrowthReport | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (y: number) => {
    try {
      const [rev, st, gr] = await Promise.all([
        api<RevenueReport>(`/reports/revenue?year=${y}`),
        api<CompanyStats>("/reports/company-stats"),
        api<GrowthReport>(`/reports/user-growth?year=${y}`),
      ]);
      setRevenue(rev);
      setStats(st);
      setGrowth(gr);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load(year);
  }, [year, load]);

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Revenue, company distribution and growth"
        actions={
          <select
            className={`${inputCls} !w-auto`}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {Array.from({ length: 5 }, (_, i) => {
              const y = new Date().getFullYear() - i;
              return (
                <option key={y} value={y}>
                  {y}
                </option>
              );
            })}
          </select>
        }
      />
      <ErrorNote message={error} />

      <div className="flex flex-col gap-4">
        <Card>
          <div className="mb-5 flex items-end justify-between">
            <h2 className="text-lg font-semibold text-stone-900">
              Monthly Revenue — {year}
            </h2>
            <p className="text-sm text-stone-500">
              Total:{" "}
              <span className="font-semibold text-stone-900">
                {fmtMoney(revenue?.total_revenue)}
              </span>
            </p>
          </div>
          {revenue && (
            <ColumnChart
              data={revenue.monthly_revenue.map((m) => ({
                label: m.month,
                value: m.revenue,
              }))}
              color={BLUE}
              format={(v) => fmtMoney(v)}
            />
          )}
        </Card>

        <Card>
          <h2 className="mb-5 text-lg font-semibold text-stone-900">
            Growth — New Companies & Users, {year}
          </h2>
          {growth && (
            <GroupedColumnChart
              months={growth.new_companies.map((m) => m.month)}
              series={[
                {
                  name: "New Companies",
                  color: BLUE,
                  values: growth.new_companies.map((m) => m.count),
                },
                {
                  name: "New Users",
                  color: GREEN,
                  values: growth.new_users.map((m) => m.count),
                },
              ]}
            />
          )}
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h2 className="mb-5 text-lg font-semibold text-stone-900">
              Companies by Status
            </h2>
            {stats && (
              <HBarList
                color={BLUE}
                items={Object.entries(stats.by_status).map(
                  ([label, value]) => ({ label, value }),
                )}
              />
            )}
          </Card>
          <Card>
            <h2 className="mb-5 text-lg font-semibold text-stone-900">
              Companies by Plan
            </h2>
            {stats && (
              <HBarList
                color={BLUE}
                items={Object.entries(stats.by_plan).map(([label, value]) => ({
                  label,
                  value,
                }))}
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
