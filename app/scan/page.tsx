"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { verifyPass } from "@/lib/pass";
import { ISSUER_PUBLIC_KEY_HEX } from "@/lib/issuer";
import type { CheckinResponse } from "@/lib/types";
import { ResultScreen, type ScanView } from "./ResultScreen";

const READER_ID = "qr-reader";
const DEBOUNCE_MS = 3000;
const RESULT_MS = 4000;

// Serializes camera start/stop so React dev double-mounting never opens two streams.
let cameraLock: Promise<void> = Promise.resolve();

export default function ScanPage() {
  const [view, setView] = useState<ScanView>({ kind: "scanning" });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const busy = useRef(false);
  const lastPass = useRef("");
  const lastSeenAt = useRef(0);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const reset = useCallback(() => {
    clearTimeout(resetTimer.current);
    busy.current = false;
    setView({ kind: "scanning" });
  }, []);

  const show = useCallback(
    (v: ScanView) => {
      setView(v);
      clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(reset, RESULT_MS);
    },
    [reset],
  );

  const handlePass = useCallback(
    async (pass: string) => {
      const post = () =>
        fetch("/api/checkin", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pass }),
          signal: AbortSignal.timeout(6000),
        });

      // 1. Verify locally with the bundled public key — instant, works offline.
      const local = await verifyPass(pass, ISSUER_PUBLIC_KEY_HEX);
      if (!local.ok) {
        show({ kind: "result", result: "INVALID_SIGNATURE" });
        post().catch(() => {}); // still log the rejection server-side
        return;
      }

      // 2. Server re-verifies and is authoritative for the guest list and duplicates.
      const name = local.payload.n;
      setView({ kind: "checking", name });
      try {
        const res = await post();
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: CheckinResponse = await res.json();
        show({
          kind: "result",
          result: data.result,
          name: data.attendee?.name ?? name,
          checkedInAt: data.checkedInAt,
        });
      } catch {
        show({ kind: "offline", name });
      }
    },
    [show],
  );

  const onDecode = useCallback(
    (text: string) => {
      const now = Date.now();
      // Same code still in view: keep extending the window so a held phone
      // doesn't re-fire the moment the result screen resets.
      if (text === lastPass.current && now - lastSeenAt.current < DEBOUNCE_MS) {
        lastSeenAt.current = now;
        return;
      }
      if (busy.current) return;
      busy.current = true;
      lastPass.current = text;
      lastSeenAt.current = now;
      void handlePass(text);
    },
    [handlePass],
  );

  // Keep the latest callback without restarting the camera.
  const onDecodeRef = useRef(onDecode);
  useEffect(() => {
    onDecodeRef.current = onDecode;
  }, [onDecode]);

  useEffect(() => {
    if (!window.isSecureContext) {
      setCameraError("Scanner requires HTTPS (or localhost).");
      return;
    }
    let cancelled = false;
    let scanner: Html5Qrcode | undefined;

    const started = cameraLock.then(async () => {
      if (cancelled) return;
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      if (cancelled) return;
      scanner = new Html5Qrcode(READER_ID, {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      });
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (w, h) => {
            const s = Math.floor(Math.min(w, h) * 0.75);
            return { width: s, height: s };
          },
        },
        (text) => onDecodeRef.current(text),
        undefined,
      );
    });
    started.catch((err) => setCameraError(`Camera unavailable: ${String(err?.message ?? err)}`));

    cameraLock = started
      .catch(() => {})
      .then(() => undefined);

    return () => {
      cancelled = true;
      clearTimeout(resetTimer.current);
      cameraLock = started
        .catch(() => {})
        .then(async () => {
          if (scanner?.isScanning) await scanner.stop();
          scanner?.clear();
        })
        .catch(() => {});
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col bg-black text-white">
      <header className="flex items-center justify-between px-4 py-3 text-sm">
        <span className="font-semibold">Smart Rollcall · Scanner</span>
        <Link href="/" className="text-neutral-400">
          Home
        </Link>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        {cameraError ? (
          <p className="max-w-sm text-center text-lg text-red-400">{cameraError}</p>
        ) : (
          <>
            <div id={READER_ID} className="w-full max-w-md overflow-hidden rounded-lg" />
            <p className="mt-4 text-neutral-400">Point the camera at a pass</p>
          </>
        )}
      </div>
      <ResultScreen view={view} onDismiss={view.kind === "checking" ? () => {} : reset} />
    </main>
  );
}
