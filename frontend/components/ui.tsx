"use client";
import { ReactNode } from "react";
import { X } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 md:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

const badgeStyles: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  approved: "bg-green-100 text-green-800",
  paid: "bg-green-100 text-green-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-stone-200 text-stone-600",
  pending: "bg-amber-100 text-amber-800",
  open: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  low: "bg-stone-200 text-stone-600",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-700",
  suspended: "bg-red-100 text-red-700",
  expired: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
  rejected: "bg-red-100 text-red-700",
  inactive: "bg-stone-200 text-stone-600",
};

export function StatusBadge({ status }: { status: string }) {
  const style = badgeStyles[status] ?? "bg-stone-200 text-stone-600";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${style}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

type ButtonVariant = "primary" | "ghost" | "danger" | "success";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-500",
  ghost:
    "border border-stone-300 bg-white text-stone-700 hover:bg-stone-100",
  danger: "bg-red-600 text-white hover:bg-red-500",
  success: "bg-green-700 text-white hover:bg-green-600",
};

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-600">
        {label}
      </span>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

export const errorInputCls =
  "!border-red-500 focus:!border-red-500 focus:!ring-red-500";

export function Table({
  headers,
  children,
  empty,
}: {
  headers: string[];
  children: ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200/80 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-400">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 text-stone-700">
          {children}
        </tbody>
      </table>
      {empty && (
        <p className="px-4 py-8 text-center text-sm text-stone-400">
          No records found
        </p>
      )}
    </div>
  );
}

export function Td({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-1 border-b border-stone-200">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${
            active === t.key
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-stone-400 hover:text-stone-600"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function pageBubbleList(current: number, total: number): (number | "…")[] {
  const delta = 1;
  const range: number[] = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      range.push(i);
    }
  }
  const withDots: (number | "…")[] = [];
  let prev = 0;
  for (const i of range) {
    if (prev) {
      if (i - prev === 2) withDots.push(prev + 1);
      else if (i - prev > 2) withDots.push("…");
    }
    withDots.push(i);
    prev = i;
  }
  return withDots;
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-1.5 text-sm">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded-lg border border-stone-200 px-3 py-1.5 font-medium text-stone-600 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous
      </button>
      {pageBubbleList(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`dots-${i}`} className="px-1.5 text-stone-400">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`flex h-8 w-8 items-center justify-center rounded-full font-medium transition-colors ${
              p === page
                ? "bg-indigo-600 text-white"
                : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="rounded-lg border border-stone-200 px-3 py-1.5 font-medium text-stone-600 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
      {message}
    </p>
  );
}
