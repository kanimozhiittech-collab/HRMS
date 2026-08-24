"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Users } from "lucide-react";
import { api, fmtMoney } from "@/lib/api";
import type { Company, Plan } from "@/lib/types";
import { Button, ErrorNote, Field, inputCls } from "@/components/ui";

function parseModules(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function RegisterPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await api<Plan[]>("/plans");
        setPlans(list.filter((p) => p.status === "active"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load plans");
      }
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (planId === null) {
      setError("Please select a plan");
      return;
    }
    setBusy(true);
    try {
      await api<Company>("/companies/register", {
        method: "POST",
        body: JSON.stringify({
          company_name: companyName,
          admin_name: adminName,
          admin_email: adminEmail,
          phone: phone,
          plan_id: planId,
        }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-300 p-4">
        <div className="w-full max-w-md rounded-3xl bg-stone-50 p-8 text-center shadow-lg">
          <CheckCircle2 size={48} className="mx-auto text-green-600" />
          <h1 className="mt-4 text-xl font-semibold text-stone-900">
            Registration Submitted!
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Thanks, <span className="font-medium">{companyName}</span>. Our team
            will review your registration. Once approved, login details will be
            sent to <span className="font-medium">{adminEmail}</span>.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm font-medium text-stone-700 underline"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-300 p-4 py-10">
      <div className="w-full max-w-2xl rounded-3xl bg-stone-50 p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="NYGROW Digital Pvt. Ltd."
            className="h-12 w-auto"
          />
          <h1 className="text-xl font-semibold text-stone-900">
            Register Your Company
          </h1>
          <p className="text-sm text-stone-500">
            Choose a plan and submit — we&apos;ll activate your account after
            review
          </p>
        </div>

        <ErrorNote message={error} />

        <form onSubmit={submit} className="flex flex-col gap-5">
          {/* Plan selection */}
          <div>
            <p className="mb-2 text-sm font-medium text-stone-600">
              Select a plan
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {plans.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPlanId(p.id)}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    planId === p.id
                      ? "border-stone-900 bg-white shadow-md ring-2 ring-stone-900"
                      : "border-stone-200 bg-white hover:border-stone-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-900">
                      {p.plan_name}
                    </span>
                    {planId === p.id && (
                      <CheckCircle2 size={18} className="text-stone-900" />
                    )}
                  </div>
                  <p className="mt-1 text-2xl font-semibold text-stone-900">
                    {fmtMoney(p.monthly_price)}
                    <span className="text-xs font-normal text-stone-400">
                      {" "}
                      /month
                    </span>
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-stone-500">
                    <Users size={12} /> Up to{" "}
                    {p.max_employees >= 999999
                      ? "unlimited"
                      : p.max_employees.toLocaleString()}{" "}
                    employees
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs text-stone-400">
                    {parseModules(p.included_modules).slice(0, 4).join(" · ")}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Company details */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name">
              <input
                required
                className={inputCls}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Erode Spinners Pvt Ltd"
              />
            </Field>
            <Field label="Admin name">
              <input
                required
                className={inputCls}
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Senthil Kumar"
              />
            </Field>
            <Field label="Admin email">
              <input
                type="email"
                required
                className={inputCls}
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="senthil@company.com"
              />
            </Field>
            <Field label="Phone">
              <input
                required
                type="tel"
                inputMode="numeric"
                className={inputCls}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="9876543210"
              />
            </Field>
          </div>

          <Button type="submit" disabled={busy} className="w-full py-2.5">
            {busy ? "Submitting…" : "Register Company"}
          </Button>
          <p className="text-center text-sm text-stone-500">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-stone-800 underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
