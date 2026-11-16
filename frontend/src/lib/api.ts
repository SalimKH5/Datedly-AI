// Typed client for the local Rust studio API.

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787").replace(/\/$/, "");

export type CalendarStatus = "draft" | "published";

export interface CalendarSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: CalendarStatus;
  entry_count: number;
  start_date: string;
  end_date: string | null;
  theme: string;
  updated_at: string;
}

export interface ModelInfo {
  name: string;
  size_bytes: number;
  parameter_size: string | null;
  family: string | null;
}

export interface AiStatus {
  status: {
    provider: string;
    endpoint: string;
    available: boolean;
    models: ModelInfo[];
    error: string | null;
  };
  selected_model: string | null;
}

export class ApiError extends Error {
  constructor(message: string, public offline = false) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
  } catch {
    throw new ApiError("The local studio is not running.", true);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  health: () => request<{ ok: boolean }>("/api/health"),
  aiStatus: () => request<AiStatus>("/api/ai/status"),
  saveSettings: (s: { ollama_endpoint?: string; model?: string }) =>
    request("/api/settings", { method: "PUT", body: JSON.stringify(s) }),
  listCalendars: () => request<CalendarSummary[]>("/api/calendars"),
};
