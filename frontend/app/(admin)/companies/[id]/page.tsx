"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { api, apiUpload, daysLeft, fmtDate, fmtDateTime, fmtMoney } from "@/lib/api";
import type {
  Company,
  Payment,
  Plan,
  Subscription,
  Ticket,
} from "@/lib/types";
import {
  Button,
  Card,
  ErrorNote,
  Modal,
  PageHeader,
  StatusBadge,
  Table,
  Td,
} from "@/components/ui";

type ApproveResult = {
  message: string;
  company_admin_email: string;
  temp_password: string;
};

type ResetPasswordResult = {
  message: string;
  admin_email: string;
  temp_password: string;
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <span className="text-sm text-stone-500">{label}</span>
      <span className="text-right text-sm font-medium text-stone-900">
        {value ?? "—"}
      </span>
    </div>
  );
}

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const companyId = Number(params.id);

  const [company, setCompany] = useState<Company | null>(null);
  const [plans, setPlans] = useState<Map<number, Plan>>(new Map());
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState<ApproveResult | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resetResult, setResetResult] = useState<ResetPasswordResult | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [comp, planList, subList, payList, ticketList] = await Promise.all([
        api<Company>(`/companies/${companyId}`),
        api<Plan[]>("/plans"),
        api<Subscription[]>(`/subscriptions?company_id=${companyId}`),
        api<Payment[]>(`/payments?company_id=${companyId}`),
        api<Ticket[]>(`/support-tickets?company_id=${companyId}`),
      ]);
      setCompany(comp);
      setPlans(new Map(planList.map((p) => [p.id, p])));
      setSubs(subList);
      setPayments(payList);
      setTickets(ticketList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const action = async (verb: string) => {
    setError("");
    setBusy(true);
    try {
      const res = await api<ApproveResult>(
        `/companies/${companyId}/${verb}`,
        { method: "POST" },
      );
      if (verb === "approve") setApproved(res);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const deleteCompany = async () => {
    setError("");
    setBusy(true);
    try {
      await api(`/companies/${companyId}`, { method: "DELETE" });
      router.push("/companies");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setError("");
    setLogoBusy(true);
    try {
      const updated = await apiUpload<Company>(`/companies/${companyId}/logo`, file);
      setCompany(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logo upload failed");
    } finally {
      setLogoBusy(false);
    }
  };

  const resetAdminPassword = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await api<ResetPasswordResult>(`/companies/${companyId}/reset-admin-password`, { method: "POST" });
      setResetResult(res);
      setConfirmReset(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed");
    } finally {
      setBusy(false);
    }
  };

  if (error && !company) return <ErrorNote message={error} />;
  if (!company) return <p className="text-sm text-stone-400">Loading…</p>;

  const plan = plans.get(company.plan_id);
  const activeSub = subs.find((s) => s.status === "active") ?? subs[0];

  return (
    <div>
      <Link
        href="/companies"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900"
      >
        <ArrowLeft size={15} /> All companies
      </Link>

      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            {company.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logo_url}
                alt={company.company_name}
                className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-stone-200"
              />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-200 text-sm font-semibold text-stone-500">
                {company.company_name.charAt(0).toUpperCase()}
              </span>
            )}
            {company.company_name}
            <label className="cursor-pointer text-xs font-medium text-stone-500 underline hover:text-stone-900">
              {logoBusy ? "Uploading…" : "Change logo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={logoBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadLogo(file);
                  e.target.value = "";
                }}
              />
            </label>
          </span>
        }
        subtitle={`Registered ${fmtDate(company.created_at)}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={company.status} />
            {company.status === "pending" && (
              <>
                <Button
                  variant="success"
                  disabled={busy}
                  onClick={() => action("approve")}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => action("reject")}
                >
                  Reject
                </Button>
              </>
            )}
            {company.status === "active" && (
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => action("suspend")}
              >
                Suspend
              </Button>
            )}
            {company.status === "suspended" && (
              <Button
                variant="success"
                disabled={busy}
                onClick={() => action("reactivate")}
              >
                Reactivate
              </Button>
            )}
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            >
              <span className="inline-flex items-center gap-1.5">
                <Trash2 size={14} /> Delete
              </span>
            </Button>
          </div>
        }
      />

      {confirmDelete && (
        <Modal
          title={`Delete ${company.company_name}?`}
          onClose={() => setConfirmDelete(false)}
        >
          <p className="text-sm text-stone-600">
            This permanently removes the company, its subscription, invoices,
            and support tickets here, and disables its admin login. This
            doesn&apos;t touch the company&apos;s own data in the HRMS app —
            that stays until removed there separately. This can&apos;t be
            undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy} onClick={deleteCompany}>
              {busy ? "Deleting…" : "Delete Company"}
            </Button>
          </div>
        </Modal>
      )}

      {confirmReset && (
        <Modal
          title={`Reset password for ${company.admin_name}?`}
          onClose={() => setConfirmReset(false)}
        >
          <p className="text-sm text-stone-600">
            This generates a new temporary password and replaces their current
            login — both here and in the company&apos;s own HRMS app, which is
            where they actually sign in. They&apos;ll need the new password to
            log in again.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy} onClick={resetAdminPassword}>
              {busy ? "Resetting…" : "Reset Password"}
            </Button>
          </div>
        </Modal>
      )}

      {resetResult && (
        <Modal title="Password Reset" onClose={() => setResetResult(null)}>
          <p className="mb-4 text-sm text-stone-600">{resetResult.message}</p>
          <div className="rounded-xl bg-stone-100 p-4 text-sm text-stone-900">
            <p>
              <span className="font-medium text-stone-700">Admin email: </span>
              {resetResult.admin_email}
            </p>
            <p className="mt-1">
              <span className="font-medium text-stone-700">
                New temporary password:{" "}
              </span>
              <code className="rounded bg-stone-200 px-1.5 py-0.5 font-mono font-semibold text-stone-900">
                {resetResult.temp_password}
              </code>
            </p>
          </div>
          <p className="mt-3 text-xs text-stone-400">
            Shown here because email sending is not connected yet. The admin
            must change this password on first login.
          </p>
        </Modal>
      )}
      <ErrorNote message={error} />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {/* Company details */}
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-900">
              Company Details
            </h2>
            <Button variant="ghost" disabled={busy} onClick={() => setConfirmReset(true)}>
              Reset Admin Password
            </Button>
          </div>
          <div className="divide-y divide-stone-100">
            <InfoRow label="Admin name" value={company.admin_name} />
            <InfoRow label="Admin email" value={company.admin_email} />
            <InfoRow label="Phone" value={company.phone} />
            <InfoRow label="GST Number" value={company.gst_number} />
            <InfoRow label="PAN Number" value={company.pan_number} />
            <InfoRow label="Address" value={company.address} />
            <InfoRow label="Locations" value={company.locations} />
            <InfoRow
              label="Plan"
              value={
                plan
                  ? `${plan.plan_name} (${fmtMoney(plan.monthly_price)}/mo)`
                  : `#${company.plan_id}`
              }
            />
            <InfoRow
              label="Database"
              value={
                company.database_name
                  ? `${company.database_type} — ${company.database_name}`
                  : "—"
              }
            />
            <InfoRow label="Approved at" value={fmtDateTime(company.approved_at)} />
          </div>
        </Card>

        {/* Subscription */}
        <Card>
          <h2 className="mb-2 text-lg font-semibold text-stone-900">
            Subscription
          </h2>
          {activeSub ? (
            <div className="divide-y divide-stone-100">
              <InfoRow
                label="Status"
                value={<StatusBadge status={activeSub.status} />}
              />
              <InfoRow
                label="Plan"
                value={plans.get(activeSub.plan_id)?.plan_name ?? "—"}
              />
              <InfoRow label="Start" value={fmtDate(activeSub.start_date)} />
              <InfoRow label="End" value={fmtDate(activeSub.end_date)} />
              <InfoRow
                label="Days left"
                value={
                  activeSub.status === "active" ? (
                    <span
                      className={
                        daysLeft(activeSub.end_date) <= 7
                          ? "text-red-600"
                          : ""
                      }
                    >
                      {daysLeft(activeSub.end_date)} days
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow
                label="Auto renew"
                value={activeSub.auto_renew ? "Yes" : "No"}
              />
            </div>
          ) : (
            <p className="py-4 text-sm text-stone-400">
              No subscription yet — created automatically on approval
            </p>
          )}
        </Card>
      </div>

      {/* Invoices */}
      <h2 className="mb-3 text-lg font-semibold text-stone-900">
        Invoices ({payments.length})
      </h2>
      <div className="mb-6">
        <Table
          headers={["Invoice #", "Purchase / Transaction ID", "Amount", "Method", "Paid On", "Status"]}
          empty={payments.length === 0}
        >
          {payments.map((p) => (
            <tr key={p.id}>
              <Td className="font-mono text-xs font-medium text-stone-900">
                {p.invoice_number}
              </Td>
              <Td className="font-mono text-xs text-stone-500">
                {p.transaction_id ?? "—"}
              </Td>
              <Td className="font-medium tabular-nums">{fmtMoney(p.amount)}</Td>
              <Td className="capitalize">{p.payment_method ?? "—"}</Td>
              <Td>{fmtDateTime(p.payment_date)}</Td>
              <Td>
                <StatusBadge status={p.status} />
              </Td>
            </tr>
          ))}
        </Table>
      </div>

      {/* Tickets */}
      <h2 className="mb-3 text-lg font-semibold text-stone-900">
        Support Tickets ({tickets.length})
      </h2>
      <Table
        headers={["Subject", "Raised By", "Priority", "Status", "Created", "Resolved"]}
        empty={tickets.length === 0}
      >
        {tickets.map((t) => (
          <tr key={t.id}>
            <Td className="font-medium text-stone-900">{t.subject}</Td>
            <Td>
              {t.raised_by_name ? (
                <>
                  <p>{t.raised_by_name}</p>
                  <p className="text-xs text-stone-400">{t.raised_by_email}</p>
                </>
              ) : (
                "—"
              )}
            </Td>
            <Td>
              <StatusBadge status={t.priority} />
            </Td>
            <Td>
              <StatusBadge status={t.status} />
            </Td>
            <Td>{fmtDate(t.created_at)}</Td>
            <Td>{fmtDateTime(t.resolved_at)}</Td>
          </tr>
        ))}
      </Table>

      {approved && (
        <Modal title="Company Approved 🎉" onClose={() => setApproved(null)}>
          <p className="mb-4 text-sm text-stone-600">{approved.message}</p>
          <div className="rounded-xl bg-stone-100 p-4 text-sm text-stone-900">
            <p>
              <span className="font-medium text-stone-700">Admin email: </span>
              {approved.company_admin_email}
            </p>
            <p className="mt-1">
              <span className="font-medium text-stone-700">
                Temp password:{" "}
              </span>
              <code className="rounded bg-stone-200 px-1.5 py-0.5 font-mono font-semibold text-stone-900">
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
