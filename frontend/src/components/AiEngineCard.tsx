"use client";

import { useState } from "react";
import { Cpu, RefreshCw } from "lucide-react";
import { api, type AiStatus } from "@/lib/api";
import { useT } from "@/lib/i18n";

function formatSize(bytes: number) {
  return bytes ? `${(bytes / 1e9).toFixed(1)} GB` : "";
}

export function AiEngineCard({
  ai,
  offline,
  onRefresh,
}: {
  ai: AiStatus | null;
  offline: boolean;
  onRefresh: () => void;
}) {
  const { t } = useT();
  const [endpoint, setEndpoint] = useState(ai?.status.endpoint ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  const available = !!ai?.status.available;
  const dot = offline ? "bg-faint" : available ? "bg-ok" : "bg-danger";
  const label = offline ? t("ai.offline") : available ? t("ai.connected") : t("ai.unreachable");

  async function save(patch: { ollama_endpoint?: string; model?: string }) {
    setMsg(null);
    try {
      await api.saveSettings(patch);
      onRefresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <section id="ai" aria-labelledby="ai-title" className="glass rounded-[2rem] p-6">
      <div className="flex items-center justify-between">
        <h2 id="ai-title" className="flex items-center gap-2 text-lg font-medium">
          <Cpu size={18} className="text-accent-2" /> {t("ai.title")}
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-surface-strong hover:text-ink"
          aria-label={t("ai.recheck")}
          title={t("ai.recheck")}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <p className="mt-4 flex items-center gap-2 text-sm" role="status">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden />
        {label}
      </p>
      {ai?.status.error && !offline && <p className="mt-2 text-sm text-danger">{ai.status.error}</p>}

      {!offline && (
        <>
          <label className="mt-5 block text-sm text-muted" htmlFor="model">
            {t("ai.model")}
          </label>
          <select
            id="model"
            disabled={!available}
            value={ai?.selected_model ?? ""}
            onChange={(e) => save({ model: e.target.value })}
            className="mt-1.5 w-full rounded-2xl border border-line bg-black/30 px-4 py-2.5 disabled:opacity-50"
          >
            {!available && <option value="">{t("ai.noModels")}</option>}
            {ai?.status.models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name} {m.parameter_size ? `· ${m.parameter_size}` : ""} {formatSize(m.size_bytes) && `· ${formatSize(m.size_bytes)}`}
              </option>
            ))}
          </select>

          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              save({ ollama_endpoint: endpoint });
            }}
          >
            <label className="block text-sm text-muted" htmlFor="endpoint">
              {t("ai.endpoint")}
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="endpoint"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="min-w-0 flex-1 rounded-2xl border border-line bg-black/30 px-4 py-2.5 text-sm"
              />
              <button type="submit" className="rounded-2xl border border-line px-4 text-sm hover:bg-surface-strong">
                {t("common.save")}
              </button>
            </div>
          </form>
          {msg && <p className="mt-2 text-sm text-danger">{msg}</p>}
        </>
      )}
    </section>
  );
}
