export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "/api/backend";

export type StoredUser = { name: string; role: string };

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("hrms_token");
}

export function setSession(token: string, user: StoredUser) {
  localStorage.setItem("hrms_token", token);
  localStorage.setItem("hrms_user", JSON.stringify(user));
}

export function getUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("hrms_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem("hrms_token");
  localStorage.removeItem("hrms_user");
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // A 401 on the login call itself means wrong credentials — let it fall
  // through to normal error handling instead of the session-expired redirect.
  if (res.status === 401 && !path.startsWith("/auth/login")) {
    clearSession();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Session expired — please login again");
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail = Array.isArray(body.detail)
          ? body.detail.map((d: any) => d.msg || JSON.stringify(d)).join("; ")
          : typeof body.detail === "string"
            ? body.detail
            : JSON.stringify(body.detail);
      }
    } catch {
      /* keep default message */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export async function apiUpload<T = unknown>(
  path: string,
  file: File,
): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail = Array.isArray(body.detail)
          ? body.detail.map((d: any) => d.msg || JSON.stringify(d)).join("; ")
          : typeof body.detail === "string"
            ? body.detail
            : JSON.stringify(body.detail);
      }
    } catch {
      /* keep default message */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const fmtMoney = (v: number | string | null | undefined) =>
  "₹" + new Intl.NumberFormat("en-IN").format(Number(v ?? 0));

export const fmtDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const fmtDateTime = (v: string | null | undefined) =>
  v
    ? new Date(v).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const daysLeft = (endDate: string) =>
  Math.ceil(
    (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
