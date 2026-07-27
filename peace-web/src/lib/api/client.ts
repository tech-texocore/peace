import { env } from "@/lib/config/env";
import { firebaseAuth } from "@/lib/firebase/client";

type Options = RequestInit & { auth?: boolean };

async function request<T>(path: string, options: Options = {}): Promise<T> {
  const { auth, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string>),
  };

  if (auth && firebaseAuth?.currentUser) {
    const token = await firebaseAuth.currentUser.getIdToken();
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    ...rest,
    headers: finalHeaders,
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
    throw new Error(message ?? `Request failed: ${res.status}`);
  }

  return (body?.data ?? body) as T;
}

export const api = {
  get: <T>(path: string, options?: Options) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, data?: unknown, options?: Options) =>
    request<T>(path, { ...options, method: "POST", body: JSON.stringify(data) }),
  put: <T>(path: string, data?: unknown, options?: Options) =>
    request<T>(path, { ...options, method: "PUT", body: JSON.stringify(data) }),
  patch: <T>(path: string, data?: unknown, options?: Options) =>
    request<T>(path, { ...options, method: "PATCH", body: JSON.stringify(data) }),
  delete: <T>(path: string, options?: Options) =>
    request<T>(path, { ...options, method: "DELETE" }),
  upload: async <T>(path: string, file: File, options?: { auth?: boolean }): Promise<T> => {
    const form = new FormData();
    form.append("file", file);
    const headers: Record<string, string> = {};
    if (options?.auth && firebaseAuth?.currentUser) {
      headers.Authorization = `Bearer ${await firebaseAuth.currentUser.getIdToken()}`;
    }
    const res = await fetch(`${env.apiBaseUrl}${path}`, { method: "POST", body: form, headers });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.message ?? `Upload failed: ${res.status}`);
    return (body?.data ?? body) as T;
  },
};
