"use client";
import { useCallback, useEffect, useState } from "react";
import { FilePlus2 } from "lucide-react";
import { api, fmtDate, fmtDateTime, fmtMoney } from "@/lib/api";
import type { Company, Payment } from "@/lib/types";
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
  { key: "paid", label: "Paid" },
  { key: "failed", label: "Failed" },
];

export default function PaymentsPage() {
  const [tab, setTab] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  // invoice form
  const [showInvoice, setShowInvoice] = useState(false);
  const [invCompany, setInvCompany] = useState("");
  const [invAmount, setInvAmount] = useState("");

  // pay form
  const [paying, setPaying] = useState<Payment | null>(null);
  const [method, setMethod] = useState("upi");
  const [txnId, setTxnId] = useState("");
  const [busy, setBusy] = useState(false);

  const companyName = (id: number) =>
    companies.find((c) => c.id === id)?.company_name ?? `Company #${id}`;

  const load = useCallback(async (status: string) => {
    try {
      const [payList, comps] = await Promise.all([
        api<Payment[]>(`/payments${status ? `?status=${status}` : ""}`),
        api<Company[]>("/companies"),
      ]);
      setPayments(payList);
      setCompanies(comps);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const createInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/payments/invoice", {
        method: "POST",
        body: JSON.stringify({
          company_id: Number(invCompany),
          amount: invAmount ? Number(invAmount) : null,
        }),
      });
      setShowInvoice(false);
      setInvCompany("");
      setInvAmount("");
      await load(tab);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invoice failed");
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paying) return;
    setBusy(true);
    setError("");
    try {
      await api(`/payments/${paying.id}/pay`, {
        method: "POST",
        body: JSON.stringify({
          payment_method: method,
          transaction_id: txnId || null,
        }),
      });
      setPaying(null);
      setTxnId("");
      await load(tab);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment update failed");
    } finally {
      setBusy(false);
    }
  };

  const markFailed = async (p: Payment) => {
    setError("");
    try {
      await api(`/payments/${p.id}/fail`, { method: "POST" });
      await load(tab);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="Payments & Invoices"
        subtitle="Billing — paid invoices extend the subscription by 30 days"
        actions={
          <Button onClick={() => setShowInvoice(true)}>
            <span className="inline-flex items-center gap-1.5">
              <FilePlus2 size={15} /> Generate Invoice
            </span>
          </Button>
        }
      />
      <ErrorNote message={error} />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <Table
        headers={[
          "Invoice #",
          "Company",
          "Amount",
          "Method",
          "Paid On",
          "Created",
          "Status",
          "Actions",
        ]}
        empty={loaded && payments.length === 0}
      >
        {payments.map((p) => (
          <tr key={p.id}>
            <Td className="font-mono text-xs font-medium text-stone-900">
              {p.invoice_number}
            </Td>
            <Td>{companyName(p.company_id)}</Td>
            <Td className="font-medium tabular-nums">{fmtMoney(p.amount)}</Td>
            <Td className="capitalize">{p.payment_method ?? "—"}</Td>
            <Td>{fmtDateTime(p.payment_date)}</Td>
            <Td>{fmtDate(p.created_at)}</Td>
            <Td>
              <StatusBadge status={p.status} />
            </Td>
            <Td>
              {p.status !== "paid" && (
                <div className="flex gap-2">
                  <Button
                    variant="success"
                    onClick={() => {
                      setPaying(p);
                      setMethod("upi");
                      setTxnId("");
                    }}
                  >
                    Mark Paid
                  </Button>
                  {p.status === "pending" && (
                    <Button variant="danger" onClick={() => markFailed(p)}>
                      Fail
                    </Button>
                  )}
                </div>
              )}
            </Td>
          </tr>
        ))}
      </Table>

      {showInvoice && (
        <Modal title="Generate Invoice" onClose={() => setShowInvoice(false)}>
          <form onSubmit={createInvoice} className="flex flex-col gap-4">
            <Field label="Company">
              <select
                required
                className={inputCls}
                value={invCompany}
                onChange={(e) => setInvCompany(e.target.value)}
              >
                <option value="">Select company…</option>
                {companies
                  .filter((c) => ["active", "suspended"].includes(c.status))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Amount (₹) — leave empty to use plan price">
              <input
                type="number"
                min="0"
                className={inputCls}
                value={invAmount}
                onChange={(e) => setInvAmount(e.target.value)}
                placeholder="Plan monthly price"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowInvoice(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create Invoice"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {paying && (
        <Modal
          title={`Mark ${paying.invoice_number} as paid`}
          onClose={() => setPaying(null)}
        >
          <form onSubmit={markPaid} className="flex flex-col gap-4">
            <p className="text-sm text-stone-500">
              {companyName(paying.company_id)} — {fmtMoney(paying.amount)}.
              Subscription extends by 30 days and a suspended company is
              reactivated.
            </p>
            <Field label="Payment method">
              <select
                className={inputCls}
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
              </select>
            </Field>
            <Field label="Transaction ID (optional)">
              <input
                className={inputCls}
                value={txnId}
                onChange={(e) => setTxnId(e.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPaying(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="success" disabled={busy}>
                {busy ? "Saving…" : "Confirm Payment"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
