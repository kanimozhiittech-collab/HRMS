"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  Button,
  Card,
  ErrorNote,
  Field,
  inputCls,
  PageHeader,
} from "@/components/ui";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirm) {
      setError("New password and confirmation do not match");
      return;
    }
    setBusy(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Change failed");
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Change Password"
        subtitle="Required after logging in with a temporary password"
      />
      <Card className="max-w-md">
        <ErrorNote message={error} />
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Current password">
            <input
              type="password"
              className={inputCls}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </Field>
          <Field label="New password (min 6 characters)">
            <input
              type="password"
              minLength={6}
              className={inputCls}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Field>
          <Field label="Confirm new password">
            <input
              type="password"
              className={inputCls}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Change Password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
