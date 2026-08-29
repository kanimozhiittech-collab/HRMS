"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ImageUp, Plus, Search, X } from "lucide-react";
import { api, apiUpload, daysLeft, fmtDate } from "@/lib/api";
import type { Company, Plan, Subscription } from "@/lib/types";
import {
  Button,
  ErrorNote,
  errorInputCls,
  Field,
  inputCls,
  Modal,
  PageHeader,
  Pagination,
  StatusBadge,
  Table,
  Tabs,
  Td,
} from "@/components/ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type AddFormErrors = Partial<Record<"company_name" | "admin_name" | "admin_email" | "phone" | "plan_id", string>>;

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

type AddResult = {
  company_name: string;
  admin_email: string;
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
  const [subsByCompany, setSubsByCompany] = useState<Map<number, Subscription>>(new Map());
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [approved, setApproved] = useState<ApproveResult | null>(null);
  const [added, setAdded] = useState<AddResult | null>(null);
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
    gst_number: "",
    pan_number: "",
    address: "",
    locations: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [addErrors, setAddErrors] = useState<AddFormErrors>({});
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (!logoFile) { setLogoPreview(null); return; }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const load = useCallback(async (status: string, q: string) => {
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      const qs = params.toString();
      const [comps, planList, subList] = await Promise.all([
        api<Company[]>(`/companies${qs ? `?${qs}` : ""}`),
        api<Plan[]>("/plans"),
        api<Subscription[]>("/subscriptions?status=active"),
      ]);
      setCompanies(comps);
      setPlans(new Map(planList.map((p) => [p.id, p])));
      setSubsByCompany(new Map(subList.map((s) => [s.company_id, s])));
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(tab, search), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [tab, search, load]);

  useEffect(() => {
    setPage(1);
  }, [tab, search]);

  const totalPages = Math.max(1, Math.ceil(companies.length / PAGE_SIZE));
  const pagedCompanies = companies.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

  const validateAddForm = (): AddFormErrors => {
    const next: AddFormErrors = {};
    if (!addForm.company_name.trim()) next.company_name = "Company name is required";
    if (!addForm.admin_name.trim()) next.admin_name = "Admin name is required";
    if (!addForm.admin_email.trim()) next.admin_email = "Admin email is required";
    else if (!EMAIL_RE.test(addForm.admin_email)) next.admin_email = "Enter a valid email address";
    if (addForm.phone.length !== 10) next.phone = "Enter a valid 10-digit phone number";
    if (!addForm.plan_id) next.plan_id = "Select a plan";
    return next;
  };

  const addCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validateAddForm();
    if (Object.keys(nextErrors).length > 0) { setAddErrors(nextErrors); return; }
    setAddErrors({});
    setError("");
    setAddBusy(true);
    try {
      const result = await api<{ id: number; company_name: string; admin_email: string; temp_password: string }>(
        "/companies/register",
        {
          method: "POST",
          body: JSON.stringify({
            company_name: addForm.company_name,
            admin_name: addForm.admin_name,
            admin_email: addForm.admin_email,
            phone: addForm.phone,
            plan_id: Number(addForm.plan_id),
            gst_number: addForm.gst_number || null,
            pan_number: addForm.pan_number || null,
            address: addForm.address || null,
            locations: addForm.locations || null,
          }),
        }
      );
      if (logoFile) {
        try {
          await apiUpload(`/companies/${result.id}/logo`, logoFile);
        } catch {
          /* logo upload failure shouldn't block company creation */
        }
      }
      setShowAdd(false);
      setAddForm({
        company_name: "",
        admin_name: "",
        admin_email: "",
        phone: "",
        plan_id: "",
        gst_number: "",
        pan_number: "",
        address: "",
        locations: "",
      });
      setLogoFile(null);
      setAdded({
        company_name: result.company_name,
        admin_email: result.admin_email,
        temp_password: result.temp_password,
      });
      setTab("active"); // registration auto-approves — company lands in Active, not Pending
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add company failed");
    } finally {
      setAddBusy(false);
    }
  };

  const clearAddError = (key: keyof AddFormErrors) =>
    setAddErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const setAdd = (key: keyof typeof addForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setAddForm((f) => ({ ...f, [key]: e.target.value }));
      clearAddError(key as keyof AddFormErrors);
    };

  const closeAddModal = () => {
    setShowAdd(false);
    setAddErrors({});
    setLogoFile(null);
  };

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
          "Plan Expiry",
          "Database",
          "Registered",
          "Status",
          "Actions",
        ]}
        empty={loaded && companies.length === 0}
      >
        {pagedCompanies.map((c) => (
          <tr
            key={c.id}
            onClick={() => router.push(`/companies/${c.id}`)}
            className="cursor-pointer transition-colors hover:bg-stone-50"
          >
            <Td className="font-medium text-stone-900 underline-offset-2 hover:underline">
              <div className="flex items-center gap-2">
                {c.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.logo_url}
                    alt={c.company_name}
                    className="h-7 w-7 shrink-0 rounded-lg object-cover ring-1 ring-stone-200"
                  />
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-200 text-xs font-semibold text-stone-500">
                    {c.company_name.charAt(0).toUpperCase()}
                  </span>
                )}
                {c.company_name}
              </div>
            </Td>
            <Td>
              <p>{c.admin_name}</p>
              <p className="text-xs text-stone-400">{c.admin_email}</p>
            </Td>
            <Td>{plans.get(c.plan_id)?.plan_name ?? `#${c.plan_id}`}</Td>
            <Td>
              {(() => {
                const sub = subsByCompany.get(c.id);
                if (!sub) return "—";
                const left = daysLeft(sub.end_date);
                return (
                  <span
                    className={
                      left <= 3
                        ? "font-semibold text-red-600"
                        : left <= 7
                          ? "font-medium text-amber-600"
                          : ""
                    }
                  >
                    {fmtDate(sub.end_date)} ({left}d)
                  </span>
                );
              })()}
            </Td>
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
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

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

      {added && (
        <Modal title="Company Created 🎉" onClose={() => setAdded(null)}>
          <p className="mb-4 text-sm text-stone-600">
            {added.company_name} was created and is already Active.
          </p>
          <div className="rounded-xl bg-stone-100 p-4 text-sm">
            <p>
              <span className="font-medium text-stone-500">Admin email: </span>
              {added.admin_email}
            </p>
            <p className="mt-1">
              <span className="font-medium text-stone-500">
                Temp password:{" "}
              </span>
              <code className="rounded bg-stone-200 px-1.5 py-0.5 font-mono">
                {added.temp_password}
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
        <Modal title="Add Company" onClose={closeAddModal}>
          <form onSubmit={addCompany} noValidate className="flex flex-col gap-4">
            <Field label="Company name" error={addErrors.company_name}>
              <input
                className={`${inputCls} ${addErrors.company_name ? errorInputCls : ""}`}
                value={addForm.company_name}
                onChange={setAdd("company_name")}
                placeholder="Erode Spinners Pvt Ltd"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Admin name" error={addErrors.admin_name}>
                <input
                  className={`${inputCls} ${addErrors.admin_name ? errorInputCls : ""}`}
                  value={addForm.admin_name}
                  onChange={setAdd("admin_name")}
                />
              </Field>
              <Field label="Phone (10 digits)" error={addErrors.phone}>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  className={`${inputCls} ${addErrors.phone ? errorInputCls : ""}`}
                  value={addForm.phone}
                  onChange={(e) => {
                    setAddForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }));
                    clearAddError("phone");
                  }}
                />
              </Field>
            </div>
            <Field label="Admin email" error={addErrors.admin_email}>
              <input
                type="email"
                className={`${inputCls} ${addErrors.admin_email ? errorInputCls : ""}`}
                value={addForm.admin_email}
                onChange={(e) => {
                  setAddForm((f) => ({ ...f, admin_email: e.target.value.toLowerCase() }));
                  clearAddError("admin_email");
                }}
              />
            </Field>
            <Field label="Plan" error={addErrors.plan_id}>
              <select
                className={`${inputCls} ${addErrors.plan_id ? errorInputCls : ""}`}
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
            <div className="grid grid-cols-2 gap-3">
              <Field label="GST Number (optional)">
                <input
                  className={inputCls}
                  placeholder="22AAAAA0000A1Z5"
                  value={addForm.gst_number}
                  onChange={setAdd("gst_number")}
                />
              </Field>
              <Field label="PAN Number (optional)">
                <input
                  className={inputCls}
                  placeholder="AAAAA0000A"
                  value={addForm.pan_number}
                  onChange={setAdd("pan_number")}
                />
              </Field>
            </div>
            <Field label="Address (optional)">
              <input
                className={inputCls}
                value={addForm.address}
                onChange={setAdd("address")}
              />
            </Field>
            <Field label="Locations (optional)">
              <input
                className={inputCls}
                placeholder="Chennai, Coimbatore, Bengaluru"
                value={addForm.locations}
                onChange={setAdd("locations")}
              />
            </Field>
            <Field label="Company logo (optional)">
              <label
                htmlFor="add-company-logo"
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-stone-300 bg-white px-3 py-2.5 text-sm transition-colors hover:border-indigo-400 hover:bg-indigo-50/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-stone-100 text-stone-400">
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageUp size={16} />
                  )}
                </span>
                <span className={`flex-1 truncate ${logoFile ? "text-stone-700" : "text-stone-400"}`}>
                  {logoFile ? logoFile.name : "Click to upload a logo"}
                </span>
                {logoFile && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setLogoFile(null); }}
                    className="shrink-0 rounded-lg p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-700"
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
              <input
                id="add-company-logo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              />
            </Field>
            <p className="text-xs text-stone-400">
              Company is created and activated immediately — the subscription
              and admin login are set up right away, no separate approval step.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={closeAddModal}>
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
