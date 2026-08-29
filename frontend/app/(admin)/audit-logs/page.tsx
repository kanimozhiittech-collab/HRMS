"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api, fmtDateTime } from "@/lib/api";
import type { AuditLog } from "@/lib/types";
import {
  ErrorNote,
  inputCls,
  PageHeader,
  Pagination,
  Table,
  Td,
} from "@/components/ui";

const PAGE_SIZE = 20;

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

const moduleLabel = (m: string) => (m === "" ? "All modules" : m.replace("_", " "));

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [module, setModule] = useState("");
  const [moduleSearch, setModuleSearch] = useState("");
  const [showModuleOptions, setShowModuleOptions] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);

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

  useEffect(() => {
    setPage(1);
  }, [module]);

  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const paged = logs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filteredModuleOptions = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    if (!q) return MODULES;
    return MODULES.filter((m) => moduleLabel(m).toLowerCase().includes(q));
  }, [moduleSearch]);

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="Who did what, when, and from which IP"
        actions={
          <div className="relative w-56">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              className={`${inputCls} pl-8`}
              placeholder="Search modules…"
              value={showModuleOptions ? moduleSearch : moduleLabel(module)}
              onFocus={() => setShowModuleOptions(true)}
              onChange={(e) => setModuleSearch(e.target.value)}
              onBlur={() => setTimeout(() => setShowModuleOptions(false), 150)}
            />
            {showModuleOptions && (
              <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-lg">
                {filteredModuleOptions.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-stone-400">No modules found</p>
                ) : (
                  filteredModuleOptions.map((m) => (
                    <button
                      type="button"
                      key={m || "all"}
                      onClick={() => {
                        setModule(m);
                        setModuleSearch("");
                        setShowModuleOptions(false);
                      }}
                      className={`block w-full px-3 py-2 text-left text-sm capitalize hover:bg-stone-100 ${
                        m === module ? "font-medium text-indigo-700" : "text-stone-700"
                      }`}
                    >
                      {moduleLabel(m)}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        }
      />
      <ErrorNote message={error} />

      <Table
        headers={["Time", "Action", "Module", "Description", "User ID", "IP"]}
        empty={loaded && logs.length === 0}
      >
        {paged.map((l) => (
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
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
