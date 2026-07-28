"use client";
import { useCallback, useEffect, useState } from "react";
import { api, fmtDateTime } from "@/lib/api";
import type { AuditLog } from "@/lib/types";
import {
  ErrorNote,
  inputCls,
  PageHeader,
  Table,
  Td,
} from "@/components/ui";

const MODULES = [
  "",
  "auth",
  "plans",
  "companies",
  "subscriptions",
  "users",
  "payments",
  "support_tickets",
  "settings",
];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [module, setModule] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (mod: string) => {
    try {
      setLogs(
        await api<AuditLog[]>(
          `/audit-logs?limit=200${mod ? `&module=${mod}` : ""}`,
        ),
      );
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load(module);
  }, [module, load]);

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="Who did what, when, and from which IP"
        actions={
          <select
            className={`${inputCls} !w-auto`}
            value={module}
            onChange={(e) => setModule(e.target.value)}
          >
            {MODULES.map((m) => (
              <option key={m} value={m}>
                {m === "" ? "All modules" : m.replace("_", " ")}
              </option>
            ))}
          </select>
        }
      />
      <ErrorNote message={error} />

      <Table
        headers={["Time", "Action", "Module", "Description", "User ID", "IP"]}
        empty={loaded && logs.length === 0}
      >
        {logs.map((l) => (
          <tr key={l.id}>
            <Td className="whitespace-nowrap text-xs text-stone-400">
              {fmtDateTime(l.created_at)}
            </Td>
            <Td className="font-medium text-stone-900">
              {l.action.replace(/_/g, " ")}
            </Td>
            <Td>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                {l.module}
              </span>
            </Td>
            <Td className="max-w-lg">{l.description ?? "—"}</Td>
            <Td>{l.user_id ?? "—"}</Td>
            <Td className="font-mono text-xs">{l.ip_address ?? "—"}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
