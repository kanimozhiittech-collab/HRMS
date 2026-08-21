"use client";
import { useCallback, useEffect, useState } from "react";
import { api, fmtDate, fmtDateTime } from "@/lib/api";
import type { Company, Ticket } from "@/lib/types";
import {
  ErrorNote,
  inputCls,
  PageHeader,
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

export default function TicketsPage() {
  const [tab, setTab] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [companies, setCompanies] = useState<Map<number, Company>>(new Map());
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

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
        empty={loaded && tickets.length === 0}
      >
        {tickets.map((t) => (
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
    </div>
  );
}
