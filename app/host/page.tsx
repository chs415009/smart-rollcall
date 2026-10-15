"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { HostGuest } from "@/lib/types";
import { GuestPanel, type GuestDraft } from "./GuestPanel";
import * as api from "./hostApi";

export default function HostPage() {
  const [passcode, setPasscode] = useState<string | null>(null); // null = not yet read from storage
  const [guests, setGuests] = useState<HostGuest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<GuestDraft>({ name: "", note: "" });

  const load = useCallback(async (code: string) => {
    try {
      setGuests(await api.fetchGuests(code));
      setError(null);
    } catch (err) {
      if (err instanceof api.UnauthorizedError) {
        api.savePasscode("");
        setPasscode("");
      }
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    const stored = api.loadPasscode();
    setPasscode(stored);
    if (stored) void load(stored);
  }, [load]);

  if (passcode === null) return null;
  if (!passcode) {
    return (
      <PasscodeGate
        error={error}
        onSubmit={(code) => {
          api.savePasscode(code);
          setPasscode(code);
          void load(code);
        }}
      />
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">Host · Guest list</h1>
        <div className="flex gap-4 text-sm text-neutral-500">
          <button
            type="button"
            className="hover:underline"
            onClick={() => {
              api.savePasscode("");
              setPasscode("");
              setGuests(null);
              setError(null);
            }}
          >
            Lock
          </button>
          <Link href="/" className="hover:underline">
            Home
          </Link>
        </div>
      </header>
      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {guests ? (
        <GuestPanel
          guests={guests}
          draft={draft}
          setDraft={setDraft}
          apply={async (change) => {
            try {
              const [result] = await api.applyChanges(passcode, [{ ...change, via: "manual" }]);
              return result;
            } finally {
              await load(passcode);
            }
          }}
        />
      ) : (
        !error && <p className="text-neutral-500">Loading…</p>
      )}
    </main>
  );
}

function PasscodeGate({ error, onSubmit }: { error: string | null; onSubmit: (code: string) => void }) {
  const [code, setCode] = useState("");
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) onSubmit(code.trim());
        }}
        className="flex flex-col gap-3"
      >
        <h1 className="text-2xl font-semibold">Host access</h1>
        <label className="text-sm text-neutral-500" htmlFor="passcode">
          Host passcode
        </label>
        <input
          id="passcode"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded border border-neutral-300 px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="rounded bg-neutral-900 px-4 py-2 font-medium text-white">
          Unlock
        </button>
      </form>
    </main>
  );
}
