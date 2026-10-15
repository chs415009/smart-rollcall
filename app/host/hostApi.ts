// Client-side calls to /api/host/*. The passcode lives in sessionStorage for this tab only.
import type { ApplyResult, HostGuest } from "@/lib/types";

const STORAGE_KEY = "hostPasscode";

export class UnauthorizedError extends Error {}

export function loadPasscode(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function savePasscode(passcode: string) {
  try {
    if (passcode) sessionStorage.setItem(STORAGE_KEY, passcode);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the passcode just won't survive a reload.
  }
}

async function hostFetch<T>(path: string, passcode: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", "x-host-passcode": passcode, ...init?.headers },
  });
  if (res.status === 401) throw new UnauthorizedError("Wrong passcode");
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as T;
}

export const fetchGuests = (passcode: string) =>
  hostFetch<{ guests: HostGuest[] }>("/api/host/guests", passcode).then((d) => d.guests);

export const applyChanges = (passcode: string, changes: unknown[]) =>
  hostFetch<{ results: ApplyResult[] }>("/api/host/apply", passcode, {
    method: "POST",
    body: JSON.stringify({ changes }),
  }).then((d) => d.results);
