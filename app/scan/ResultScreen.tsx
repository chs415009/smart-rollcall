import type { CheckinResult } from "@/lib/types";

export type ScanView =
  | { kind: "scanning" }
  | { kind: "checking"; name: string }
  | { kind: "result"; result: CheckinResult; name?: string; checkedInAt?: string }
  | { kind: "offline"; name: string }; // signature verified locally, server unreachable

const STYLES: Record<CheckinResult, { bg: string; icon: string; detail: string }> = {
  VALID: { bg: "bg-green-600 text-white", icon: "✓", detail: "Checked in" },
  DUPLICATE: { bg: "bg-amber-400 text-black", icon: "!", detail: "Already checked in" },
  INVALID_SIGNATURE: { bg: "bg-red-600 text-white", icon: "✕", detail: "Invalid pass — signature failed" },
  NOT_ON_LIST: { bg: "bg-red-600 text-white", icon: "✕", detail: "Not on the guest list" },
  // Distinct icon from the ✕ of a forged pass: this one was genuine, then withdrawn.
  REVOKED: { bg: "bg-red-600 text-white", icon: "⊘", detail: "Invitation withdrawn" },
};

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function ResultScreen({ view, onDismiss }: { view: ScanView; onDismiss: () => void }) {
  if (view.kind === "scanning") return null;

  let bg: string, icon: string, title: string | undefined, detail: string;
  if (view.kind === "checking") {
    [bg, icon, title, detail] = ["bg-neutral-800 text-white", "…", view.name, "Signature valid — checking list"];
  } else if (view.kind === "offline") {
    [bg, icon, title, detail] = ["bg-neutral-700 text-white", "✓", view.name, "Signature verified offline — not recorded"];
  } else {
    const s = STYLES[view.result];
    [bg, icon, detail] = [s.bg, s.icon, s.detail];
    // A failed signature means the name in the payload is untrusted — never show it.
    title = view.result === "INVALID_SIGNATURE" ? undefined : view.name;
    if (view.result === "DUPLICATE" && view.checkedInAt) {
      detail = `Already checked in at ${timeOf(view.checkedInAt)}`;
    }
  }

  return (
    <button
      type="button"
      onClick={onDismiss}
      className={`fixed inset-0 z-10 flex flex-col items-center justify-center p-8 text-center ${bg}`}
    >
      <div className="text-[9rem] leading-none font-bold sm:text-[12rem]">{icon}</div>
      {title && <div className="mt-6 text-5xl font-bold break-words sm:text-7xl">{title}</div>}
      <div className="mt-4 text-2xl font-medium sm:text-4xl">{detail}</div>
    </button>
  );
}
