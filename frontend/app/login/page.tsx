"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { api, setSession } from "@/lib/api";
import { Button, ErrorNote, Field, inputCls } from "@/components/ui";

type LoginResponse = {
  access_token: string;
  token_type: string;
  role: string;
  name: string;
  is_temp_password: boolean;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setSession(res.access_token, { name: res.name, role: res.role });
      router.replace(res.is_temp_password ? "/change-password" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-300 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-stone-50 p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="NYGROW Digital Pvt. Ltd."
            className="h-12 w-auto"
          />
          <h1 className="text-xl font-semibold text-stone-900">NYGROW HRM</h1>
          <p className="text-sm text-stone-500">Sign in to your console</p>
        </div>

        <ErrorNote message={error} />

        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Email">
            <input
              type="email"
              required
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="superadmin@hrms.com"
            />
          </Field>
          <Field label="Password">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                className={`${inputCls} pr-10`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-stone-400 hover:text-stone-700"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
          <Button type="submit" disabled={busy} className="mt-2 w-full py-2.5">
            {busy ? "Signing in…" : "Sign In"}
          </Button>
          <p className="text-center text-sm text-stone-500">
            New company?{" "}
            <Link
              href="/register"
              className="font-medium text-stone-800 underline"
            >
              Register here
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
