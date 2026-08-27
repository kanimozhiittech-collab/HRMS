"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api, fmtDate, fmtDateTime } from "@/lib/api";
import type { Company, Ticket } from "@/lib/types";
import {
  ErrorNote,
  inputCls,
  PageHeader,
  Pagination,
  StatusBadge,
  Table,
  Tabs,
  Td,
} from "@/components/ui";

const TABS = [
  { key: "", label: "All" },
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
];

const STATUSES = ["open", "in_progress", "resolved", "closed"];
const PRIORITIES = ["low", "medium", "high"];
const PAGE_SIZE = 20;

export default function TicketsPage() {
  const [tab, setTab] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [companies, setCompanies] = useState<Map<number, Company>>(new Map());
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async (status: string) => {
    try {
      const [ticketList, comps] = await Promise.all([
        api<Ticket[]>(`/support-tickets${status ? `?status=${status}` : ""}`),
        api<Company[]>("/companies"),
      ]);
      setTickets(ticketList);
      setCompanies(new Map(comps.map((c) => [c.id, c])));
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  useEffect(() => {
    setPage(1);
  }, [tab, search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((t) =>
      (companies.get(t.company_id)?.company_name ?? "")
        .toLowerCase()
        .includes(q),
    );
  }, [tickets, companies, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const update = async (
    ticket: Ticket,
    changes: { status?: string; priority?: string },
  ) => {
    setError("");
    try {
      await api(`/support-tickets/${ticket.id}`, {
        method: "PUT",
        body: JSON.stringify(changes),
      });
      await load(tab);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="Support Tickets"
        subtitle="Issues raised by company admins"
      />
      <ErrorNote message={error} />
      <div className="mb-3 relative w-full max-w-xs">
        <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          className={`${inputCls} pl-8`}
          placeholder="Search by company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <Table
        headers={[
          "Subject",
          "Company",
          "Raised By",
          "Priority",
          "Status",
          "Created",
          "Resolved",
        ]}
        empty={loaded && filtered.length === 0}
      >
        {paged.map((t) => (
          <tr key={t.id}>
            <Td className="max-w-md">
              <p className="font-medium text-stone-900">{t.subject}</p>
              {t.description && (
                <p className="mt-0.5 line-clamp-2 text-xs text-stone-400">
                  {t.description}
                </p>
              )}
            </Td>
            <Td>
              {companies.get(t.company_id)?.company_name ??
                `Company #${t.company_id}`}
            </Td>
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
              <select
                className={`${inputCls} !w-auto !py-1`}
                value={t.priority}
                onChange={(e) => update(t, { priority: e.target.value })}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Td>
            <Td>
              <div className="flex items-center gap-2">
                <StatusBadge status={t.status} />
                <select
                  className={`${inputCls} !w-auto !py-1`}
                  value={t.status}
                  onChange={(e) => update(t, { status: e.target.value })}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
            </Td>
            <Td>{fmtDate(t.created_at)}</Td>
            <Td>{fmtDateTime(t.resolved_at)}</Td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
