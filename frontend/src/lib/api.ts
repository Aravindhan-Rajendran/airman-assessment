export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const LOGIN_PATH = '/login';

export type User = {
  id: string;
  email: string;
  role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';
  tenantId: string | null;
  approved: boolean;
};

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken');
}

function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  window.location.href = LOGIN_PATH;
}

/**
 * Call refresh endpoint directly (no 401 retry) and return new tokens.
 * Throws on failure or non-2xx.
 */
async function doRefresh(): Promise<{ accessToken: string; refreshToken: string }> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');
  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Refresh failed');
  return data as { accessToken: string; refreshToken: string };
}

/**
 * On 401: try refresh, store new tokens, return true. On refresh failure: clear tokens, redirect to login, throw.
 * Only call this when isRetry is false and path is not /api/auth/refresh.
 */
async function tryRefreshAndRetry<T>(path: string, options: RequestInit): Promise<T> {
  try {
    const { accessToken, refreshToken } = await doRefresh();
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    }
    return api<T>(path, options, true);
  } catch {
    clearTokens();
    redirectToLogin();
    throw new Error('Session expired. Please sign in again.');
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public requestId?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Core API helper. On 401: attempts refresh once, retries original request once, then fails and redirects to login.
 * @param isRetry - when true, do not attempt refresh on 401 (avoids infinite loop).
 */
export async function api<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  const requestId = res.headers.get('x-request-id') ?? undefined;

  if (res.status === 401 && !isRetry && path !== '/api/auth/refresh' && path !== '/api/auth/login') {
    return tryRefreshAndRetry<T>(path, options);
  }

  if (!res.ok) {
    const msg = data.error || res.statusText || 'Request failed';
    throw new ApiError(msg, res.status, data.code, requestId);
  }
  return data as T;
}

export const authApi = {
  login: (email: string, password: string, tenantId?: string) =>
    api<{ accessToken: string; refreshToken: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, tenantId }),
    }),
  refresh: (refreshToken: string) =>
    api<{ accessToken: string; refreshToken: string; user: User }>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
  me: () => api<User>('/api/auth/me'),
  register: (body: { email: string; password: string; role: string; tenantId: string }) =>
    api<User>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  approveStudent: (userId: string, approved: boolean) =>
    api<{ success: boolean }>('/api/auth/approve-student', {
      method: 'POST',
      body: JSON.stringify({ userId, approved }),
    }),
  listPendingStudents: () => api<{ data: { id: string; email: string; createdAt: string }[] }>('/api/auth/students-pending'),
  logout: (refreshToken: string) =>
    fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }),
};

export const tenantsApi = {
  list: () => api<{ data: { id: string; name: string; slug: string }[] }>('/api/tenants'),
};

export type Instructor = { id: string; email: string };

export const instructorsApi = {
  list: () => api<{ data: Instructor[] }>('/api/instructors'),
};

// Shared types for courses – single source of truth (must match backend GET /api/courses/:id response)
export type Lesson = { id: string; title: string; type: string; content?: string | null };
export type CourseModule = { id: string; title: string; lessons: Lesson[] };
export type CourseDetail = {
  id: string;
  title: string;
  description: string | null;
  modules: CourseModule[];
};

export const coursesApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    return api<{ data: CourseDetail[]; total: number; page: number; limit: number }>(`/api/courses?${q}`);
  },
  get: (id: string) => api<CourseDetail>(`/api/courses/${id}`),
  create: (title: string, description?: string) =>
    api<CourseDetail>('/api/courses', { method: 'POST', body: JSON.stringify({ title, description }) }),
  createModule: (courseId: string, data: { title: string; order?: number }) =>
    api<{ id: string; courseId: string; title: string; order: number }>(
      `/api/courses/${courseId}/modules`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
  createLesson: (
    courseId: string,
    moduleId: string,
    data: { title: string; type: 'TEXT' | 'QUIZ'; content?: string; order?: number }
  ) =>
    api<{ id: string; moduleId: string; title: string; type: string; content: string | null; order: number }>(
      `/api/courses/${courseId}/modules/${moduleId}/lessons`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
};

// Shared type for scheduling (must match backend booking response)
export type Booking = {
  id?: string;
  startAt?: string;
  endAt?: string;
  status?: string;
  studentId?: string;
  instructorId?: string | null;
  student?: { id: string; email: string };
  instructor?: { id: string; email: string } | null;
};

export type AuditLogEntry = {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  correlationId: string | null;
  createdAt: string;
};

export const auditApi = {
  list: (params?: { page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return api<{ data: AuditLogEntry[]; total: number; page: number; limit: number }>(`/api/audit?${q}`);
  },
};

export const schedulingApi = {
  listBookings: (params?: { page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return api<{ data: Booking[]; total: number }>(`/api/scheduling/bookings?${q}`);
  },
  weeklyBookings: (weekStart: string) =>
    api<{ data: Booking[] }>(`/api/scheduling/bookings/weekly?weekStart=${weekStart}`),
  createBooking: (requestedAt: string, startAt: string, endAt: string) =>
    api<unknown>('/api/scheduling/bookings', {
      method: 'POST',
      body: JSON.stringify({ requestedAt, startAt, endAt }),
    }),
  approveBooking: (id: string) => api<unknown>(`/api/scheduling/bookings/${id}/approve`, { method: 'PATCH' }),
  assignBooking: (id: string, instructorId: string) =>
    api<unknown>(`/api/scheduling/bookings/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ instructorId }),
    }),
  completeBooking: (id: string) => api<unknown>(`/api/scheduling/bookings/${id}/complete`, { method: 'PATCH' }),
  cancelBooking: (id: string) => api<unknown>(`/api/scheduling/bookings/${id}/cancel`, { method: 'PATCH' }),
  addAvailability: (startAt: string, endAt: string, instructorId?: string) =>
    api<unknown>('/api/scheduling/availability', {
      method: 'POST',
      body: JSON.stringify({ startAt, endAt, instructorId }),
    }),
  listAvailability: (params?: { page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return api<{ data: unknown[]; total: number }>(`/api/scheduling/availability?${q}`);
  },
};
