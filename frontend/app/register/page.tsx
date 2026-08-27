"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Company, Plan } from "@/lib/types";
import { Button, ErrorNote, Field, inputCls } from "@/components/ui";

export default function RegisterPage() {
  // No plan picker here — a self-registered company starts on the default
  // (cheapest active) plan; the Super Admin can change it after approval.
  const [defaultPlanId, setDefaultPlanId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [address, setAddress] = useState("");
  const [locations, setLocations] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await api<Plan[]>("/plans");
        const active = list.filter((p) => p.status === "active");
        const cheapest = active.sort((a, b) => Number(a.monthly_price) - Number(b.monthly_price))[0];
        if (cheapest) setDefaultPlanId(cheapest.id);
        else setError("No plan is available for registration — contact support.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load plans");
      }
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (defaultPlanId === null) {
      setError("No plan is available for registration — contact support.");
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
          plan_id: defaultPlanId,
          gst_number: gstNumber || null,
          pan_number: panNumber || null,
          address: address || null,
          locations: locations || null,
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
            You&apos;re All Set!
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Thanks, <span className="font-medium">{companyName}</span>. Your
            account is active — login details have been sent to{" "}
            <span className="font-medium">{adminEmail}</span>.
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
            Tell us about your company and we&apos;ll activate your account
            right away
          </p>
        </div>

        <ErrorNote message={error} />

        <form onSubmit={submit} className="flex flex-col gap-5">
          {/* Company details */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name">
              <input
                className={inputCls}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Erode Spinners Pvt Ltd"
              />
            </Field>
            <Field label="Admin name">
              <input
                className={inputCls}
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Senthil Kumar"
              />
            </Field>
            <Field label="Admin email">
              <input
                type="email"
                className={inputCls}
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value.toLowerCase())}
                placeholder="senthil@company.com"
              />
            </Field>
            <Field label="Phone (10 digits)">
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                pattern="\d{10}"
                title="Enter exactly 10 digits"
                className={inputCls}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="9876543210"
              />
            </Field>
            <Field label="GST Number (optional)">
              <input
                className={inputCls}
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                placeholder="22AAAAA0000A1Z5"
              />
            </Field>
            <Field label="PAN Number (optional)">
              <input
                className={inputCls}
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value)}
                placeholder="AAAAA0000A"
              />
            </Field>
            <Field label="Address (optional)">
              <input
                className={inputCls}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Company address"
              />
            </Field>
            <Field label="Locations (optional)">
              <input
                className={inputCls}
                value={locations}
                onChange={(e) => setLocations(e.target.value)}
                placeholder="Chennai, Coimbatore, Bengaluru"
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
