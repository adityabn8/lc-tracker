const BASE = "/api";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? "Request failed", body);
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: unknown
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const auth = {
  me: () => request<User>("/auth/me"),
  signup: (data: { email: string; password: string; timezone: string }) =>
    request<User>("/auth/signup", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request<User>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  updateTimezone: (timezone: string) =>
    request<User>("/auth/me", { method: "PATCH", body: JSON.stringify({ timezone }) }),
};

// ---------------------------------------------------------------------------
// Problems
// ---------------------------------------------------------------------------
export const problems = {
  add: (data: {
    problemId: number;
    title: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    tags?: string[];
    initialSolvedAt?: string;
  }) =>
    request<TrackedProblem>("/problems", { method: "POST", body: JSON.stringify(data) }),
  due: () => request<TrackedProblem[]>("/problems/due"),
  list: (params?: {
    difficulty?: string;
    tag?: string;
    status?: string;
    stage?: string;
    search?: string;
    sort?: string;
  }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v) as [string, string][]
    ).toString();
    return request<TrackedProblem[]>(`/problems${qs ? `?${qs}` : ""}`);
  },
  detail: (trackedId: string) =>
    request<TrackedProblemDetail>(`/problems/${trackedId}`),
  remove: (trackedId: string) =>
    request<{ ok: boolean }>(`/problems/${trackedId}`, { method: "DELETE" }),
  restart: (trackedId: string) =>
    request<TrackedProblem>(`/problems/${trackedId}/restart`, { method: "POST" }),
};

// ---------------------------------------------------------------------------
// Attempts
// ---------------------------------------------------------------------------
export const attempts = {
  pass: (trackedId: string) =>
    request<AttemptResult>(`/problems/${trackedId}/attempts`, {
      method: "POST",
      body: JSON.stringify({ outcome: "PASS" }),
    }),
  fail: (trackedId: string, failureNote: string) =>
    request<AttemptResult>(`/problems/${trackedId}/attempts`, {
      method: "POST",
      body: JSON.stringify({ outcome: "FAIL", failureNote }),
    }),
  undo: (trackedId: string, attemptId: string) =>
    request<{ ok: boolean; trackedProblem: Partial<TrackedProblem> }>(
      `/problems/${trackedId}/attempts/${attemptId}`,
      { method: "DELETE" }
    ),
};

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
export const stats = {
  get: () => request<Stats>("/stats"),
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface User {
  id: string;
  email: string;
  timezone: string;
}

export interface Problem {
  id: number;
  title: string;
  slug: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  tags: string[];
  url: string;
}

export interface TrackedProblem {
  id: string;
  problemId: number;
  initialSolvedAt: string | null;
  currentStage: number;
  nextDueDate: string | null;
  status: "ACTIVE" | "MASTERED";
  resetCount: number;
  createdAt: string;
  daysOverdue: number | null;
  problem: Problem;
}

export interface Attempt {
  id: string;
  stage: number;
  attemptedAt: string;
  outcome: "PASS" | "FAIL";
  failureNote: string | null;
  createdAt: string;
}

export interface TrackedProblemDetail extends TrackedProblem {
  attempts: Attempt[];
}

export interface AttemptResult {
  attempt: Attempt;
  trackedProblem: {
    currentStage: number;
    nextDueDate: string | null;
    status: "ACTIVE" | "MASTERED";
    resetCount: number;
  };
}

export interface Stats {
  totalTracked: number;
  totalActive: number;
  totalMastered: number;
  totalAttempts: number;
  passAttempts: number;
  retentionRate: number | null;
  totalResets: number;
  weakSpots: Array<{
    id: string;
    resetCount: number;
    problem: { id: number; title: string; difficulty: string };
  }>;
  difficultyBreakdown: { EASY: number; MEDIUM: number; HARD: number };
  topTags: Array<{ tag: string; count: number }>;
  upcoming: { next7: number; next30: number };
}
