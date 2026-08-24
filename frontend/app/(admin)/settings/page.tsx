"use client";
import { useCallback, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { api, fmtDateTime } from "@/lib/api";
import type { Setting } from "@/lib/types";
import {
  Button,
  Card,
  ErrorNote,
  inputCls,
  PageHeader,
} from "@/components/ui";

function humanize(key: string) {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api<Setting[]>("/settings");
      setSettings(list);
      setValues(
        Object.fromEntries(
          list.map((s) => [s.setting_key, s.setting_value ?? ""]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changed = settings.filter(
    (s) => (s.setting_value ?? "") !== (values[s.setting_key] ?? ""),
  );

  const save = async () => {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const body = Object.fromEntries(
        changed.map((s) => [s.setting_key, values[s.setting_key]]),
      );
      await api("/settings", { method: "PUT", body: JSON.stringify(body) });
      setSaved(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Global Settings"
        subtitle="Platform-wide configuration used across modules"
        actions={
          <Button onClick={save} disabled={busy || changed.length === 0}>
            <span className="inline-flex items-center gap-1.5">
              <Save size={15} />
              {busy
                ? "Saving…"
                : changed.length > 0
                  ? `Save ${changed.length} change${changed.length > 1 ? "s" : ""}`
                  : "Saved"}
            </span>
          </Button>
        }
      />
      <ErrorNote message={error} />
      {saved && (
        <p className="mb-4 rounded-xl bg-green-50 px-4 py-2.5 text-sm text-green-800">
          Settings saved successfully
        </p>
      )}

      <Card className="!p-0">
        <div className="divide-y divide-stone-100">
          {settings.map((s) => (
            <div
              key={s.setting_key}
              className="flex flex-wrap items-center gap-4 px-5 py-4"
            >
              <div className="min-w-64 flex-1">
                <p className="text-sm font-medium text-stone-900">
                  {humanize(s.setting_key)}
                </p>
                {s.description && (
                  <p className="mt-0.5 text-xs text-stone-400">
                    {s.description}
                  </p>
                )}
              </div>
              <div className="w-72">
                <input
                  className={inputCls}
                  value={values[s.setting_key] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      [s.setting_key]: e.target.value,
                    }))
                  }
                />
                <p className="mt-1 text-right text-[11px] text-stone-300">
                  updated {fmtDateTime(s.updated_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
