"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { api, fmtDateTime } from "@/lib/api";
import type { Notification } from "@/lib/types";
import { Button, Card, ErrorNote, PageHeader } from "@/components/ui";

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const requestId = useRef(0);
  // Mirrors unreadOnly so async handlers reload with the CURRENT filter,
  // not the value captured when the handler was created.
  const unreadOnlyRef = useRef(unreadOnly);
  unreadOnlyRef.current = unreadOnly;

  const load = useCallback(async (unread: boolean) => {
    // Guard against overlapping loads (e.g. "mark all read" reload racing
    // a filter toggle) — only the newest request may update the list.
    const id = ++requestId.current;
    try {
      const data = await api<Notification[]>(
        `/notifications${unread ? "?unread_only=true" : ""}`,
      );
      if (requestId.current !== id) return;
      setItems(data);
      setLoaded(true);
    } catch (err) {
      if (requestId.current !== id) return;
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load(unreadOnly);
  }, [unreadOnly, load]);

  const markRead = async (id: number) => {
    try {
      await api(`/notifications/${id}/read`, { method: "PUT" });
      await load(unreadOnlyRef.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const markAllRead = async () => {
    try {
      await api("/notifications/read-all", { method: "PUT" });
      await load(unreadOnlyRef.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Registrations, payments, renewals and tickets"
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => setUnreadOnly((v) => !v)}
            >
              {unreadOnly ? "Show All" : "Unread Only"}
            </Button>
            <Button onClick={markAllRead}>
              <span className="inline-flex items-center gap-1.5">
                <CheckCheck size={15} /> Mark All Read
              </span>
            </Button>
          </>
        }
      />
      <ErrorNote message={error} />

      <div className="flex flex-col gap-2">
        {loaded && items.length === 0 && (
          <p className="py-8 text-center text-sm text-stone-400">
            No notifications
          </p>
        )}
        {items.map((n) => (
          <Card
            key={n.id}
            className={`flex items-start gap-3 !p-4 ${
              n.is_read ? "opacity-70" : ""
            }`}
          >
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                n.is_read
                  ? "bg-stone-100 text-stone-400"
                  : "bg-stone-900 text-white"
              }`}
            >
              <Bell size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-stone-900">{n.title}</p>
                {!n.is_read && (
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                )}
              </div>
              {n.message && (
                <p className="mt-0.5 text-sm text-stone-500">{n.message}</p>
              )}
              <p className="mt-1 text-xs text-stone-400">
                {n.type.replace(/_/g, " ")} · {fmtDateTime(n.sent_at)}
              </p>
            </div>
            {!n.is_read && (
              <Button variant="ghost" onClick={() => markRead(n.id)}>
                Mark Read
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
