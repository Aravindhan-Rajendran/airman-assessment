'use client';

import { useState, useEffect } from 'react';
import { useRequireAuth } from '@/context/AuthContext';
import { schedulingApi, type Booking } from '@/lib/api';

export default function SchedulePage() {
  const { user } = useRequireAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().slice(0, 10);
  });
  const [weekly, setWeekly] = useState<Booking[]>([]);
  const [requestedAt, setRequestedAt] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [availStart, setAvailStart] = useState('');
  const [availEnd, setAvailEnd] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadBookings = () => {
    setError(null);
    schedulingApi.listBookings({ page, limit: 10 })
      .then((r) => {
        setBookings(Array.isArray(r.data) ? r.data : []);
        setTotal(r.total);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load schedule');
      });
  };
  useEffect(() => { loadBookings(); }, [page]);

  useEffect(() => {
    setError(null);
    schedulingApi.weeklyBookings(weekStart)
      .then((r) => setWeekly(Array.isArray(r.data) ? r.data : []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load weekly view'));
  }, [weekStart]);

  const handleRequestBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestedAt || !startAt || !endAt) return;
    setSubmitting(true);
    setError(null);
    try {
      const req = new Date(requestedAt).toISOString();
      const start = new Date(startAt).toISOString();
      const end = new Date(endAt).toISOString();
      await schedulingApi.createBooking(req, start, end);
      setRequestedAt('');
      setStartAt('');
      setEndAt('');
      loadBookings();
      setWeekly([]);
      schedulingApi.weeklyBookings(weekStart).then((r) => setWeekly(Array.isArray(r.data) ? r.data : []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request booking');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!availStart || !availEnd) return;
    setSubmitting(true);
    setError(null);
    try {
      await schedulingApi.addAvailability(
        new Date(availStart).toISOString(),
        new Date(availEnd).toISOString()
      );
      setAvailStart('');
      setAvailEnd('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add availability');
    } finally {
      setSubmitting(false);
    }
  };

  const isStudent = user?.role === 'STUDENT';
  const isInstructorOrAdmin = user?.role === 'INSTRUCTOR' || user?.role === 'ADMIN';

  return (
    <div>
      <h1>Schedule</h1>
      {error && <p className="error">{error}</p>}

      {isStudent && (
        <section className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
          <h2 style={{ marginTop: 0 }}>Request a booking</h2>
          <p style={{ marginBottom: '1rem', opacity: 0.9 }}>Choose when you want a training slot. Your school will approve or assign an instructor.</p>
          <form onSubmit={handleRequestBooking}>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>When you are requesting (date & time)</label>
              <input type="datetime-local" value={requestedAt} onChange={(e) => setRequestedAt(e.target.value)} required style={{ padding: '0.5rem', minWidth: 200 }} />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Preferred start (date & time)</label>
              <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required style={{ padding: '0.5rem', minWidth: 200 }} />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Preferred end (date & time)</label>
              <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} required style={{ padding: '0.5rem', minWidth: 200 }} />
            </div>
            <button type="submit" disabled={submitting} style={{ padding: '0.5rem 1rem' }}>
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
          </form>
        </section>
      )}

      {isInstructorOrAdmin && (
        <section className="card" style={{ marginBottom: '1rem' }}>
          <h2>Add availability</h2>
          <form onSubmit={handleAddAvailability}>
            <label style={{ display: 'block', marginBottom: 4 }}>Start (datetime)</label>
            <input type="datetime-local" value={availStart} onChange={(e) => setAvailStart(e.target.value)} required style={{ marginRight: 8, marginBottom: 8 }} />
            <label style={{ display: 'block', marginBottom: 4 }}>End (datetime)</label>
            <input type="datetime-local" value={availEnd} onChange={(e) => setAvailEnd(e.target.value)} required style={{ marginRight: 8, marginBottom: 8 }} />
            <br />
            <button type="submit" disabled={submitting}>Add availability</button>
          </form>
        </section>
      )}

      <h2>Weekly view</h2>
      <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
      <ul style={{ listStyle: 'none', marginTop: 8 }}>
        {weekly.length === 0 ? <li>No bookings this week.</li> : weekly.map((b) => (
          <li key={b.id} className="card">
            {b.startAt} – {b.endAt} | {b.status}
          </li>
        ))}
      </ul>
      <h2>All bookings (paginated)</h2>
      <ul style={{ listStyle: 'none' }}>
        {bookings.length === 0 ? <li>No bookings yet.</li> : bookings.map((b) => (
          <li key={b.id} className="card">{b.startAt} – {b.status}</li>
        ))}
      </ul>
      <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
      <span style={{ margin: '0 1rem' }}>Page {page}</span>
      <button disabled={page * 10 >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
    </div>
  );
}
