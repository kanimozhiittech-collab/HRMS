"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { api, fmtDate } from "@/lib/api";
import type { Company, Plan } from "@/lib/types";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("status") ?? "");

  useEffect(() => {
    setTab(searchParams.get("status") ?? "");
  }, [searchParams]);
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<Map<number, Plan>>(new Map());
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [approved, setApproved] = useState<ApproveResult | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Add Company modal state
  const [showAdd, setShowAdd] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addForm, setAddForm] = useState({
    company_name: "",
    admin_name: "",
    admin_email: "",
    phone: "",
    plan_id: "",
  });

  const load = useCallback(async (status: string, q: string) => {
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      const qs = params.toString();
      const [comps, planList] = await Promise.all([
        api<Company[]>(`/companies${qs ? `?${qs}` : ""}`),
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
    const timer = setTimeout(() => load(tab, search), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [tab, search, load]);

  const action = async (companyId: number, verb: string) => {
    setError("");
    setBusyId(companyId);
    try {
      const res = await api<ApproveResult>(`/companies/${companyId}/${verb}`, {
        method: "POST",
      });
      if (verb === "approve") setApproved(res);
      await load(tab, search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const addCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setAddBusy(true);
    try {
      await api("/companies/register", {
        method: "POST",
        body: JSON.stringify({
          company_name: addForm.company_name,
          admin_name: addForm.admin_name,
          admin_email: addForm.admin_email,
          phone: addForm.phone || null,
          plan_id: Number(addForm.plan_id),
        }),
      });
      setShowAdd(false);
      setAddForm({
        company_name: "",
        admin_name: "",
        admin_email: "",
        phone: "",
        plan_id: "",
      });
      setTab("pending"); // new company lands in Pending — jump there
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add company failed");
    } finally {
      setAddBusy(false);
    }
  };

  const setAdd = (key: keyof typeof addForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setAddForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="Companies"
        subtitle="Registrations, approvals and company status"
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <span className="inline-flex items-center gap-1.5">
              <Plus size={15} /> Add Company
            </span>
          </Button>
        }
      />
      <ErrorNote message={error} />
      <div className="mb-3 relative w-full max-w-xs">
        <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          className={`${inputCls} pl-8`}
          placeholder="Search company, admin name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
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
          <tr
            key={c.id}
            onClick={() => router.push(`/companies/${c.id}`)}
            className="cursor-pointer transition-colors hover:bg-stone-50"
          >
            <Td className="font-medium text-stone-900 underline-offset-2 hover:underline">
              {c.company_name}
            </Td>
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
            <Td className="!cursor-default" >
              <div
                className="flex gap-2"
                onClick={(e) => e.stopPropagation()}
              >
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

      {showAdd && (
        <Modal title="Add Company" onClose={() => setShowAdd(false)}>
          <form onSubmit={addCompany} className="flex flex-col gap-4">
            <Field label="Company name">
              <input
                required
                className={inputCls}
                value={addForm.company_name}
                onChange={setAdd("company_name")}
                placeholder="Erode Spinners Pvt Ltd"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Admin name">
                <input
                  required
                  className={inputCls}
                  value={addForm.admin_name}
                  onChange={setAdd("admin_name")}
                />
              </Field>
              <Field label="Phone (optional)">
                <input
                  className={inputCls}
                  value={addForm.phone}
                  onChange={setAdd("phone")}
                />
              </Field>
            </div>
            <Field label="Admin email">
              <input
                type="email"
                required
                className={inputCls}
                value={addForm.admin_email}
                onChange={setAdd("admin_email")}
              />
            </Field>
            <Field label="Plan">
              <select
                required
                className={inputCls}
                value={addForm.plan_id}
                onChange={setAdd("plan_id")}
              >
                <option value="">Select plan…</option>
                {[...plans.values()]
                  .filter((p) => p.status === "active")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.plan_name}
                    </option>
                  ))}
              </select>
            </Field>
            <p className="text-xs text-stone-400">
              Company is created in Pending status — approve it to activate,
              create the subscription and the admin login.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addBusy}>
                {addBusy ? "Adding…" : "Add Company"}
              </Button>
            </div>
          </form>
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
