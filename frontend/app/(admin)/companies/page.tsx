"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, fmtDate } from "@/lib/api";
import type { Company, Plan } from "@/lib/types";
import {
  Button,
  ErrorNote,
  Modal,
  PageHeader,
  StatusBadge,
  Table,
  Tabs,
  Td,
} from "@/components/ui";

const TABS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "active", label: "Active" },
  { key: "suspended", label: "Suspended" },
  { key: "rejected", label: "Rejected" },
];

type ApproveResult = {
  message: string;
  company_admin_email: string;
  temp_password: string;
};

function CompaniesContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("status") ?? "");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<Map<number, Plan>>(new Map());
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [approved, setApproved] = useState<ApproveResult | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (status: string) => {
    try {
      const [comps, planList] = await Promise.all([
        api<Company[]>(`/companies${status ? `?status=${status}` : ""}`),
        api<Plan[]>("/plans"),
      ]);
      setCompanies(comps);
      setPlans(new Map(planList.map((p) => [p.id, p])));
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const action = async (companyId: number, verb: string) => {
    setError("");
    setBusyId(companyId);
    try {
      const res = await api<ApproveResult>(`/companies/${companyId}/${verb}`, {
        method: "POST",
      });
      if (verb === "approve") setApproved(res);
      await load(tab);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Companies"
        subtitle="Registrations, approvals and company status"
      />
      <ErrorNote message={error} />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <Table
        headers={[
          "Company",
          "Admin",
          "Plan",
          "Database",
          "Registered",
          "Status",
          "Actions",
        ]}
        empty={loaded && companies.length === 0}
      >
        {companies.map((c) => (
          <tr key={c.id}>
            <Td className="font-medium text-stone-900">{c.company_name}</Td>
            <Td>
              <p>{c.admin_name}</p>
              <p className="text-xs text-stone-400">{c.admin_email}</p>
            </Td>
            <Td>{plans.get(c.plan_id)?.plan_name ?? `#${c.plan_id}`}</Td>
            <Td>
              {c.database_name ? (
                <>
                  <p className="capitalize">{c.database_type}</p>
                  <p className="text-xs text-stone-400">{c.database_name}</p>
                </>
              ) : (
                "—"
              )}
            </Td>
            <Td>{fmtDate(c.created_at)}</Td>
            <Td>
              <StatusBadge status={c.status} />
            </Td>
            <Td>
              <div className="flex gap-2">
                {c.status === "pending" && (
                  <>
                    <Button
                      variant="success"
                      disabled={busyId === c.id}
                      onClick={() => action(c.id, "approve")}
                    >
                      {busyId === c.id ? "…" : "Approve"}
                    </Button>
                    <Button
                      variant="danger"
                      disabled={busyId === c.id}
                      onClick={() => action(c.id, "reject")}
                    >
                      Reject
                    </Button>
                  </>
                )}
                {c.status === "active" && (
                  <Button
                    variant="danger"
                    disabled={busyId === c.id}
                    onClick={() => action(c.id, "suspend")}
                  >
                    Suspend
                  </Button>
                )}
                {c.status === "suspended" && (
                  <Button
                    variant="success"
                    disabled={busyId === c.id}
                    onClick={() => action(c.id, "reactivate")}
                  >
                    Reactivate
                  </Button>
                )}
              </div>
            </Td>
          </tr>
        ))}
      </Table>

      {approved && (
        <Modal title="Company Approved 🎉" onClose={() => setApproved(null)}>
          <p className="mb-4 text-sm text-stone-600">{approved.message}</p>
          <div className="rounded-xl bg-stone-100 p-4 text-sm">
            <p>
              <span className="font-medium text-stone-500">Admin email: </span>
              {approved.company_admin_email}
            </p>
            <p className="mt-1">
              <span className="font-medium text-stone-500">
                Temp password:{" "}
              </span>
              <code className="rounded bg-stone-200 px-1.5 py-0.5 font-mono">
                {approved.temp_password}
              </code>
            </p>
          </div>
          <p className="mt-3 text-xs text-stone-400">
            Shown here because email sending is not connected yet. The admin
            must change this password on first login.
          </p>
        </Modal>
      )}
    </div>
  );
}

export default function CompaniesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-stone-400">Loading…</p>}>
      <CompaniesContent />
    </Suspense>
  );
}
