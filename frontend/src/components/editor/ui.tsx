"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n";

export const field =
  "w-full rounded-2xl border border-line bg-black/25 px-4 py-2.5 text-ink placeholder:text-faint focus:border-accent/60 focus:outline-none";

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-sm text-muted">
      {label}
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

/** In-page confirmation (never a browser dialog). */
export function ConfirmDialog({
  title,
  body,
  warning,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  warning?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[2rem] border border-line bg-[#120f2e] p-6"
      >
        <h2 id="confirm-title" className="text-lg font-medium">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
        {warning && (
          <p className="mt-3 flex gap-2 rounded-2xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {warning}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="rounded-2xl border border-line px-4 py-2.5 text-sm hover:bg-surface-strong">
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-2xl px-4 py-2.5 text-sm font-medium text-white ${danger ? "bg-red-600 hover:bg-red-500" : "bg-accent hover:brightness-110"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
