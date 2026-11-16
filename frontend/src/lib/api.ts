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

export type Block =
  | { type: "text" | "fact" | "story" | "challenge"; body: string }
  | { type: "activity"; body: string; steps: string[] }
  | { type: "quiz"; question: string; choices: string[]; answer_index: number; explanation?: string | null }
  | { type: "resource"; label: string; url: string | null }
  | { type: "image_prompt"; description: string }
  | { type: "custom"; label: string; data: unknown };

export interface Entry {
  id: string;
  index: number;
  title: string;
  date: string;
  content_type: string;
  blocks: Block[];
  metadata: Record<string, unknown>;
  status: "scheduled" | "hidden";
}

export interface PlanSection {
  title: string;
  from: number;
  to: number;
  focus: string;
}

export type Interval = { kind: "daily" } | { kind: "weekly" } | { kind: "monthly" } | { kind: "every_n_days"; days: number };

export interface Schedule {
  start_date: string;
  interval: Interval;
  timezone: string;
  unlock_time: string;
}

export interface Calendar {
  id: string;
  slug: string;
  title: string;
  description: string;
  prompt: string;
  language: string;
  theme: string;
  schedule: Schedule;
  status: CalendarStatus;
  entries: Entry[];
  generation: {
    provider: string;
    model: string;
    duration_secs: number;
    warnings: string[];
    sections: PlanSection[];
    audience: string;
    tone: string;
  } | null;
  publication: { published_at: string; demo: { start: string; every_minutes: number } | null } | null;
  created_at: string;
  updated_at: string;
}

/** What a visitor receives: locked entries carry only their number and time. */
export interface PublicEntry {
  index: number;
  date: string;
  unlock_at: string;
  unlocked: boolean;
  content?: { title: string; content_type: string; blocks: Block[] };
}

export interface PublicCalendar {
  slug: string;
  title: string;
  description: string;
  theme: string;
  language: string;
  timezone: string;
  demo: boolean;
  generated_at: string;
  entry_count: number;
  unlocked_count: number;
  next_unlock_at: string | null;
  entries: PublicEntry[];
}

export interface PublishResult {
  calendar: Calendar;
  bundle: string;
  key: { source: "env" } | { source: "file"; path: string; created: boolean } | null;
}

export type Stage = "understanding" | "planning" | "writing" | "validating" | "saving" | "done";

export interface Job {
  id: string;
  status: "running" | "done" | "failed";
  stage: Stage;
  message: string;
  done: number;
  total: number;
  model: string;
  log: string[];
  brief: {
    title: string;
    description: string;
    audience: string;
    tone: string;
    language: string;
    entry_count: number;
    interval: string;
    start_date: string;
    content_formats: string[];
    theme: string;
  } | null;
  plan: { sections: PlanSection[]; entries: { index: number; title: string; content_type: string }[] } | null;
  calendar_id: string | null;
  error: string | null;
}

export interface GenerateInput {
  prompt: string;
  entry_count?: number;
  start_date?: string;
  language?: string;
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
  getCalendar: (id: string) => request<Calendar>(`/api/calendars/${encodeURIComponent(id)}`),
  generate: (input: GenerateInput) =>
    request<{ job_id: string; model: string }>("/api/generate", { method: "POST", body: JSON.stringify(input) }),
  job: (id: string) => request<Job>(`/api/jobs/${encodeURIComponent(id)}`),
  currentJob: () => request<{ job: Job | null }>("/api/jobs/current"),
  saveCalendar: (c: Calendar) =>
    request<Calendar>(`/api/calendars/${encodeURIComponent(c.id)}`, { method: "PUT", body: JSON.stringify(c) }),
  deleteCalendar: (id: string) => request<void>(`/api/calendars/${encodeURIComponent(id)}`, { method: "DELETE" }),
  publish: (id: string, demoEveryMinutes?: number) =>
    request<PublishResult>(`/api/calendars/${encodeURIComponent(id)}/publish`, {
      method: "POST",
      body: JSON.stringify(demoEveryMinutes ? { demo_every_minutes: demoEveryMinutes } : {}),
    }),
  unpublish: (id: string) => request<Calendar>(`/api/calendars/${encodeURIComponent(id)}/unpublish`, { method: "POST" }),
  publicCalendar: (slug: string) => request<PublicCalendar>(`/api/public/${encodeURIComponent(slug)}`),
  regenerateCalendar: (id: string) =>
    request<{ job_id: string; model: string }>(`/api/calendars/${encodeURIComponent(id)}/regenerate`, { method: "POST" }),
  regenerateEntry: (id: string, entry: Entry, instruction: string) =>
    request<Entry>(`/api/calendars/${encodeURIComponent(id)}/entries/regenerate`, {
      method: "POST",
      body: JSON.stringify({ entry, instruction }),
    }),
};
