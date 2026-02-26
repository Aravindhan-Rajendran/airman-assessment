'use client';

import { useState, useEffect } from 'react';
import { useRequireAuth } from '@/context/AuthContext';
import { authApi, schedulingApi, type Booking } from '@/lib/api';

export default function AdminPage() {
  const { user } = useRequireAuth();
  const [pending, setPending] = useState<{ id: string; email: string }[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    if (user?.role !== 'ADMIN' && user?.role !== 'INSTRUCTOR') return;
    authApi.listPendingStudents().then((r) => setPending(r.data)).catch(() => {});
    schedulingApi.listBookings({ page: 1, limit: 50 }).then((r) => setBookings(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [user?.role]);

  const handleApprove = async (userId: string, approved: boolean) => {
    await authApi.approveStudent(userId, approved);
    setPending((p) => p.filter((x) => x.id !== userId));
  };

  return (
    <div>
      <h1>Admin</h1>
      {user?.role === 'ADMIN' && (
        <section className="card">
          <h2>Pending students</h2>
          <ul style={{ listStyle: 'none' }}>
            {pending.map((s) => (
              <li key={s.id} style={{ marginBottom: 8 }}>
                {s.email}{' '}
                <button onClick={() => handleApprove(s.id, true)}>Approve</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="card">
        <h2>Bookings</h2>
        <ul style={{ listStyle: 'none' }}>
          {bookings.slice(0, 10).map((b) => (
            <li key={b.id}>{b.startAt} – {b.status}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
