const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
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
};

export const tenantsApi = {
  list: () => api<{ data: { id: string; name: string; slug: string }[] }>('/api/tenants'),
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
};

// Shared type for scheduling (must match backend booking response)
export type Booking = { id?: string; startAt?: string; endAt?: string; status?: string };

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
