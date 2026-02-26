'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/context/AuthContext';
import { coursesApi } from '@/lib/api';

export default function CoursesPage() {
  const { user } = useRequireAuth();
  const [data, setData] = useState<{ data: { id: string; title: string }[]; total: number; page: number; limit: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setError(null);
    coursesApi.list({ page, limit: 10, search: search || undefined })
      .then(setData)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load courses');
        setData({ data: [], total: 0, page: 1, limit: 10 });
      });
  }, [page, search]);

  if (data === null) return <div>Loading...</div>;

  const canCreate = user?.role === 'INSTRUCTOR' || user?.role === 'ADMIN';

  return (
    <div>
      <h1>Courses</h1>
      {error && <p className="error">{error}</p>}
      <p style={{ marginBottom: '1rem', opacity: 0.9 }}>
        {data.data.length > 0 ? 'Click a course to open it and view lessons and quizzes.' : ''}
        {canCreate && (
          <>
            {' '}
            <Link href="/dashboard/courses/new">Create a new course</Link>.
          </>
        )}
      </p>
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          placeholder="Search by course or module title"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ width: 300, marginRight: 8 }}
        />
        {canCreate && (
          <Link href="/dashboard/courses/new" className="button" style={{ display: 'inline-block' }}>
            Create course
          </Link>
        )}
      </div>
      {data.data.length === 0 ? (
        <p>No courses yet. {canCreate ? 'Create one to get started.' : 'Your school has not added any courses.'}</p>
      ) : (
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {data.data.map((c) => (
          <li key={c.id} className="card" style={{ marginBottom: '0.75rem' }}>
            <Link href={`/dashboard/courses/${c.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', padding: '0.25rem 0' }}>
              <span><strong>{c.title}</strong></span>
              <span style={{ opacity: 0.8 }}>View course →</span>
            </Link>
          </li>
        ))}
      </ul>
      )}
      <div style={{ marginTop: '1rem' }}>
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
        <span style={{ margin: '0 1rem' }}>Page {data.page} of {Math.ceil(data.total / data.limit)}</span>
        <button disabled={page >= Math.ceil(data.total / data.limit)} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </div>
  );
}
