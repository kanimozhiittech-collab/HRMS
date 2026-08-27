"use client";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Users } from "lucide-react";
import { api, fmtMoney } from "@/lib/api";
import type { Plan } from "@/lib/types";
import {
  Button,
  Card,
  ErrorNote,
  Field,
  inputCls,
  Modal,
  PageHeader,
  StatusBadge,
} from "@/components/ui";

type PlanForm = {
  plan_name: string;
  monthly_price: string;
  max_employees: string;
  trial_period_days: string;
  included_modules: string; // comma separated in the form
  status: string;
};

const emptyForm: PlanForm = {
  plan_name: "",
  monthly_price: "0",
  max_employees: "10",
  trial_period_days: "0",
  included_modules: "",
  status: "active",
};

function parseModules(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState<PlanForm | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setPlans(await api<Plan[]>("/plans"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
  };

  const openEdit = (p: Plan) => {
    setEditId(p.id);
    setForm({
      plan_name: p.plan_name,
      monthly_price: String(p.monthly_price),
      max_employees: String(p.max_employees),
      trial_period_days: String(p.trial_period_days),
      included_modules: parseModules(p.included_modules).join(", "),
      status: p.status,
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError("");
    const body = {
      plan_name: form.plan_name,
      monthly_price: Number(form.monthly_price),
      max_employees: Number(form.max_employees),
      trial_period_days: Number(form.trial_period_days),
      included_modules: form.included_modules
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
      status: form.status,
    };
    try {
      if (editId === null) {
        await api("/plans", { method: "POST", body: JSON.stringify(body) });
      } else {
        await api(`/plans/${editId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      }
      setForm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (p: Plan) => {
    setError("");
    try {
      await api(`/plans/${p.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deactivate failed");
    }
  };

  const set = (key: keyof PlanForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => (f ? { ...f, [key]: e.target.value } : f));

  return (
    <div>
      <PageHeader
        title="Subscription Plans"
        subtitle="Pricing tiers shown on the public registration page"
        actions={
          <Button onClick={openCreate}>
            <span className="inline-flex items-center gap-1.5">
              <Plus size={15} /> New Plan
            </span>
          </Button>
        }
      />
      <ErrorNote message={error} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => (
          <Card key={p.id} className="flex flex-col">
            <div className="mb-2 flex items-start justify-between">
              <h2 className="text-lg font-semibold text-stone-900">
                {p.plan_name}
              </h2>
              <StatusBadge status={p.status} />
            </div>
            <p className="text-3xl font-semibold tracking-tight text-stone-900">
              {fmtMoney(p.monthly_price)}
              <span className="text-sm font-normal text-stone-400"> /month</span>
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-stone-500">
              <Users size={14} /> Up to{" "}
              {p.max_employees >= 999999
                ? "unlimited"
                : p.max_employees.toLocaleString()}{" "}
              employees
            </p>
            {p.trial_period_days > 0 && (
              <p className="mt-1 text-sm text-stone-500">
                {p.trial_period_days}-day trial
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {parseModules(p.included_modules).map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600"
                >
                  {m}
                </span>
              ))}
            </div>
            <div className="mt-auto flex gap-2 pt-4">
              <Button variant="ghost" onClick={() => openEdit(p)}>
                <span className="inline-flex items-center gap-1.5">
                  <Pencil size={13} /> Edit
                </span>
              </Button>
              {p.status === "active" && (
                <Button variant="danger" onClick={() => deactivate(p)}>
                  Deactivate
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {form && (
        <Modal
          title={editId === null ? "New Plan" : "Edit Plan"}
          onClose={() => setForm(null)}
        >
          <form onSubmit={save} className="flex flex-col gap-4">
            <Field label="Plan name">
              <input
                className={inputCls}
                value={form.plan_name}
                onChange={set("plan_name")}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Monthly price (₹)">
                <input
                  type="number"
                  min="0"
                  className={inputCls}
                  value={form.monthly_price}
                  onChange={set("monthly_price")}
                />
              </Field>
              <Field label="Max employees">
                <input
                  type="number"
                  min="1"
                  className={inputCls}
                  value={form.max_employees}
                  onChange={set("max_employees")}
                />
              </Field>
              <Field label="Trial days">
                <input
                  type="number"
                  min="0"
                  className={inputCls}
                  value={form.trial_period_days}
                  onChange={set("trial_period_days")}
                />
              </Field>
            </div>
            <Field label="Included modules (comma separated)">
              <textarea
                rows={3}
                className={inputCls}
                value={form.included_modules}
                onChange={set("included_modules")}
                placeholder="Employee Management, Attendance, Leave Management"
              />
            </Field>
            <Field label="Status">
              <select
                className={inputCls}
                value={form.status}
                onChange={set("status")}
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save Plan"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
