"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PlayCircle } from "lucide-react";
import { api, daysLeft, fmtDate } from "@/lib/api";
import type { Company, Plan, Subscription } from "@/lib/types";
import {
  Button,
  ErrorNote,
  Field,
  inputCls,
  Modal,
  PageHeader,
  StatusBadge,
  Table,
  Tabs,
  Td,
} from "@/components/ui";

const TABS = [
  { key: "", label: "All" },
  { key: "active", label: "Active" },
  { key: "expired", label: "Expired" },
  { key: "expiring", label: "Expiring Soon" },
];

function SubscriptionsContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(
    searchParams.get("expiring") ? "expiring" : "",
  );

  useEffect(() => {
    setTab(searchParams.get("expiring") ? "expiring" : "");
  }, [searchParams]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [companies, setCompanies] = useState<Map<number, Company>>(new Map());
  const [plans, setPlans] = useState<Map<number, Plan>>(new Map());
  const [error, setError] = useState("");
  const [extendSub, setExtendSub] = useState<Subscription | null>(null);
  const [extendDays, setExtendDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [checkResult, setCheckResult] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [subList, comps, planList] = await Promise.all([
        api<Subscription[]>("/subscriptions"),
        api<Company[]>("/companies"),
        api<Plan[]>("/plans"),
      ]);
      setSubs(subList);
      setCompanies(new Map(comps.map((c) => [c.id, c])));
      setPlans(new Map(planList.map((p) => [p.id, p])));
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = subs.filter((s) => {
    if (tab === "expiring")
      return s.status === "active" && daysLeft(s.end_date) <= 7;
    if (tab) return s.status === tab;
    return true;
  });

  const extend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendSub) return;
    setBusy(true);
    setError("");
    try {
      await api(`/subscriptions/${extendSub.id}/extend`, {
        method: "POST",
        body: JSON.stringify({ days: Number(extendDays) }),
      });
      setExtendSub(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extend failed");
    } finally {
      setBusy(false);
    }
  };

  const runExpiryCheck = async () => {
    setError("");
    setCheckResult("");
    try {
      const res = await api<{
        reminders_sent: number;
        companies_suspended: number;
      }>("/subscriptions/check-expiry", { method: "POST" });
      setCheckResult(
        `Expiry check done — ${res.reminders_sent} reminders sent, ${res.companies_suspended} companies suspended.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        subtitle="Active periods, renewals and expiry"
        actions={
          <Button variant="ghost" onClick={runExpiryCheck}>
            <span className="inline-flex items-center gap-1.5">
              <PlayCircle size={15} /> Run Expiry Check
            </span>
          </Button>
        }
      />
      <ErrorNote message={error} />
      {checkResult && (
        <p className="mb-4 rounded-xl bg-green-50 px-4 py-2.5 text-sm text-green-800">
          {checkResult}
        </p>
      )}
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <Table
        headers={[
          "Company",
          "Plan",
          "Start",
          "End",
          "Days Left",
          "Auto Renew",
          "Status",
          "Actions",
        ]}
        empty={loaded && visible.length === 0}
      >
        {visible.map((s) => {
          const left = daysLeft(s.end_date);
          return (
            <tr key={s.id}>
              <Td className="font-medium text-stone-900">
                {companies.get(s.company_id)?.company_name ??
                  `Company #${s.company_id}`}
              </Td>
              <Td>{plans.get(s.plan_id)?.plan_name ?? `#${s.plan_id}`}</Td>
              <Td>{fmtDate(s.start_date)}</Td>
              <Td>{fmtDate(s.end_date)}</Td>
              <Td
                className={
                  s.status !== "active"
                    ? "text-stone-400"
                    : left <= 3
                      ? "font-semibold text-red-600"
                      : left <= 7
                        ? "font-medium text-amber-600"
                        : ""
                }
              >
                {s.status === "active" ? `${left} days` : "—"}
              </Td>
              <Td>{s.auto_renew ? "Yes" : "No"}</Td>
              <Td>
                <StatusBadge status={s.status} />
              </Td>
              <Td>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setExtendSub(s);
                    setExtendDays("30");
                  }}
                >
                  Extend
                </Button>
              </Td>
            </tr>
          );
        })}
      </Table>

      {extendSub && (
        <Modal
          title={`Extend subscription — ${
            companies.get(extendSub.company_id)?.company_name ??
            `#${extendSub.company_id}`
          }`}
          onClose={() => setExtendSub(null)}
        >
          <form onSubmit={extend} className="flex flex-col gap-4">
            <p className="text-sm text-stone-500">
              Current end date: {fmtDate(extendSub.end_date)}. The subscription
              becomes active again and a suspended company is reactivated.
            </p>
            <Field label="Days to add">
              <input
                type="number"
                min="1"
                required
                className={inputCls}
                value={extendDays}
                onChange={(e) => setExtendDays(e.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setExtendSub(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Extending…" : "Extend"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-stone-400">Loading…</p>}>
      <SubscriptionsContent />
    </Suspense>
  );
}
