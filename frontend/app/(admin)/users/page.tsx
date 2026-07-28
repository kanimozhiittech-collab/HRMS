"use client";
import { useCallback, useEffect, useState } from "react";
import { KeyRound, UserPlus } from "lucide-react";
import { api, fmtDateTime } from "@/lib/api";
import type { Company, User } from "@/lib/types";
import {
  Button,
  ErrorNote,
  Field,
  inputCls,
  Modal,
  PageHeader,
  StatusBadge,
  Table,
  Td,
} from "@/components/ui";

type ResetResult = { message: string; temp_password: string };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ company_id: "", name: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState<ResetResult | null>(null);

  const companyName = (id: number | null) =>
    id === null
      ? "—"
      : (companies.find((c) => c.id === id)?.company_name ?? `Company #${id}`);

  const load = useCallback(async () => {
    try {
      const [userList, comps] = await Promise.all([
        api<User[]>("/users"),
        api<Company[]>("/companies"),
      ]);
      setUsers(userList);
      setCompanies(comps);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/users", {
        method: "POST",
        body: JSON.stringify({
          company_id: Number(form.company_id),
          name: form.name,
          email: form.email,
        }),
      });
      setShowCreate(false);
      setForm({ company_id: "", name: "", email: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (u: User) => {
    setError("");
    const next = u.status === "active" ? "inactive" : "active";
    try {
      await api(`/users/${u.id}/status?status=${next}`, { method: "PUT" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const resetPassword = async (u: User) => {
    setError("");
    try {
      const res = await api<ResetResult>(`/users/${u.id}/reset-password`, {
        method: "POST",
      });
      setReset(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="Platform Users"
        subtitle="Super admin and company admins (employees live in each company's HRMS)"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <span className="inline-flex items-center gap-1.5">
              <UserPlus size={15} /> New Company Admin
            </span>
          </Button>
        }
      />
      <ErrorNote message={error} />

      <Table
        headers={[
          "Name",
          "Email",
          "Role",
          "Company",
          "Last Login",
          "Status",
          "Actions",
        ]}
        empty={loaded && users.length === 0}
      >
        {users.map((u) => (
          <tr key={u.id}>
            <Td className="font-medium text-stone-900">
              {u.name}
              {u.is_temp_password && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  temp password
                </span>
              )}
            </Td>
            <Td>{u.email}</Td>
            <Td className="capitalize">{u.role.replace("_", " ")}</Td>
            <Td>{companyName(u.company_id)}</Td>
            <Td>{fmtDateTime(u.last_login)}</Td>
            <Td>
              <StatusBadge status={u.status} />
            </Td>
            <Td>
              {u.role !== "super_admin" && (
                <div className="flex gap-2">
                  <Button
                    variant={u.status === "active" ? "danger" : "success"}
                    onClick={() => toggleStatus(u)}
                  >
                    {u.status === "active" ? "Deactivate" : "Activate"}
                  </Button>
                  <Button variant="ghost" onClick={() => resetPassword(u)}>
                    <span className="inline-flex items-center gap-1.5">
                      <KeyRound size={13} /> Reset
                    </span>
                  </Button>
                </div>
              )}
            </Td>
          </tr>
        ))}
      </Table>

      {showCreate && (
        <Modal title="New Company Admin" onClose={() => setShowCreate(false)}>
          <form onSubmit={create} className="flex flex-col gap-4">
            <Field label="Company">
              <select
                required
                className={inputCls}
                value={form.company_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, company_id: e.target.value }))
                }
              >
                <option value="">Select company…</option>
                {companies
                  .filter((c) => c.status === "active")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Name">
              <input
                required
                className={inputCls}
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                required
                className={inputCls}
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </Field>
            <p className="text-xs text-stone-400">
              A temporary password is generated and emailed. The user must
              change it on first login.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create Admin"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {reset && (
        <Modal title="Password Reset" onClose={() => setReset(null)}>
          <p className="mb-3 text-sm text-stone-600">{reset.message}</p>
          <div className="rounded-xl bg-stone-100 p-4 text-sm">
            <span className="font-medium text-stone-500">Temp password: </span>
            <code className="rounded bg-stone-200 px-1.5 py-0.5 font-mono">
              {reset.temp_password}
            </code>
          </div>
          <p className="mt-3 text-xs text-stone-400">
            Shown here because email sending is not connected yet.
          </p>
        </Modal>
      )}
    </div>
  );
}
