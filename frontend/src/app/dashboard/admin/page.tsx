'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRequireAuth } from '@/context/AuthContext';
import { authApi, schedulingApi, instructorsApi, auditApi, type Booking, type AuditLogEntry } from '@/lib/api';

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export default function AdminPage() {
  const { user } = useRequireAuth(['ADMIN']);
  const [pending, setPending] = useState<{ id: string; email: string }[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignInstructorId, setAssignInstructorId] = useState('');
  const [instructors, setInstructors] = useState<{ id: string; email: string }[]>([]);
  const [instructorEmail, setInstructorEmail] = useState('');
  const [instructorPassword, setInstructorPassword] = useState('');
  const [instructorError, setInstructorError] = useState('');
  const [instructorSuccess, setInstructorSuccess] = useState('');
  const [creatingInstructor, setCreatingInstructor] = useState(false);
  const [students, setStudents] = useState<{ id: string; email: string; approved: boolean; createdAt: string }[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);

  const loadBookings = useCallback(() => {
    if (user?.role !== 'ADMIN') return;
    setBookingsLoading(true);
    setBookingsError(null);
    schedulingApi
      .listBookings({ page: 1, limit: 50 })
      .then((r) => setBookings(Array.isArray(r.data) ? r.data : []))
      .catch((err) => setBookingsError(err instanceof Error ? err.message : 'Failed to load bookings'))
      .finally(() => setBookingsLoading(false));
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    authApi.listPendingStudents().then((r) => setPending(r.data)).catch(() => {});
    authApi.listStudents().then((r) => setStudents(r.data)).catch(() => setStudents([]));
    instructorsApi.list().then((r) => setInstructors(r.data)).catch(() => setInstructors([]));
    loadBookings();
  }, [user?.role, loadBookings]);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    auditApi.list({ page: auditPage, limit: 10 })
      .then((r) => { setAuditLogs(r.data); setAuditTotal(r.total); })
      .catch(() => {});
  }, [user?.role, auditPage]);

  const handleApprove = async (userId: string, approved: boolean) => {
    await authApi.approveStudent(userId, approved);
    setPending((p) => p.filter((x) => x.id !== userId));
    authApi.listStudents().then((r) => setStudents(r.data)).catch(() => {});
  };

  const runBookingAction = async (
    bookingId: string,
    action: () => Promise<unknown>,
    onSuccess: () => void
  ) => {
    setActionLoadingId(bookingId);
    setActionError(null);
    try {
      await action();
      onSuccess();
      loadBookings();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoadingId(null);
      setAssigningId(null);
      setAssignInstructorId('');
    }
  };

  const handleApproveBooking = (b: Booking) => {
    if (!b.id) return;
    runBookingAction(b.id, () => schedulingApi.approveBooking(b.id!), () => {});
  };

  const handleAssignBooking = (b: Booking) => {
    if (!b.id) return;
    const instructorId = assignInstructorId.trim();
    if (!instructorId) {
      setActionError('Select an instructor');
      return;
    }
    runBookingAction(
      b.id,
      () => schedulingApi.assignBooking(b.id!, instructorId),
      () => {}
    );
  };

  const handleCompleteBooking = (b: Booking) => {
    if (!b.id) return;
    runBookingAction(b.id, () => schedulingApi.completeBooking(b.id!), () => {});
  };

  const handleCancelBooking = (b: Booking) => {
    if (!b.id) return;
    runBookingAction(b.id, () => schedulingApi.cancelBooking(b.id!), () => {});
  };

  const status = (b: Booking) => (b.status ?? '').toUpperCase();
  const isRequested = (b: Booking) => status(b) === 'REQUESTED';
  const isApproved = (b: Booking) => status(b) === 'APPROVED';
  const isAssigned = (b: Booking) => status(b) === 'ASSIGNED';
  const isCompleted = (b: Booking) => status(b) === 'COMPLETED';
  const isCancelled = (b: Booking) => status(b) === 'CANCELLED';
  const canAct = (b: Booking) => !isCompleted(b) && !isCancelled(b);

  const handleCreateInstructor = async (e: React.FormEvent) => {
    e.preventDefault();
    setInstructorError('');
    setInstructorSuccess('');
    const email = instructorEmail.trim();
    const password = instructorPassword;
    if (!email) {
      setInstructorError('Email is required');
      return;
    }
    if (!password) {
      setInstructorError('Password is required');
      return;
    }
    if (!STRONG_PASSWORD_REGEX.test(password)) {
      setInstructorError('Password must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)');
      return;
    }
    if (!user?.tenantId) {
      setInstructorError('Tenant required');
      return;
    }
    setCreatingInstructor(true);
    try {
      await authApi.register({
        email,
        password,
        role: 'INSTRUCTOR',
        tenantId: user.tenantId,
      });
      setInstructorSuccess('Instructor created successfully. They can log in with this email and password.');
      setInstructorEmail('');
      setInstructorPassword('');
      instructorsApi.list().then((r) => setInstructors(r.data)).catch(() => {});
    } catch (err) {
      setInstructorError(err instanceof Error ? err.message : 'Failed to create instructor');
    } finally {
      setCreatingInstructor(false);
    }
  };

  return (
    <div>
      <h1>Admin</h1>
      {user?.role === 'ADMIN' && (
        <>
          <section className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginTop: 0 }}>Create instructor</h2>
            <form onSubmit={handleCreateInstructor} style={{ maxWidth: 400 }} noValidate>
              <div className="form-field" style={{ marginBottom: 12 }}>
                <label htmlFor="instructor-email">Email <span className="form-required">*</span></label>
                <input
                  id="instructor-email"
                  type="email"
                  value={instructorEmail}
                  onChange={(e) => setInstructorEmail(e.target.value)}
                  className="form-input"
                  placeholder="instructor@school.com"
                  autoComplete="email"
                />
              </div>
              <div className="form-field" style={{ marginBottom: 12 }}>
                <label htmlFor="instructor-password">Password <span className="form-required">*</span></label>
                <input
                  id="instructor-password"
                  type="password"
                  value={instructorPassword}
                  onChange={(e) => setInstructorPassword(e.target.value)}
                  className="form-input"
                  placeholder="Min 8 chars, upper, lower, number, special"
                  autoComplete="new-password"
                />
              </div>
              {instructorError && (
                <div className="form-message form-message--error" role="alert" style={{ marginBottom: 12 }}>
                  {instructorError}
                </div>
              )}
              {instructorSuccess && (
                <div className="form-message success" role="alert" style={{ marginBottom: 12 }}>
                  {instructorSuccess}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={creatingInstructor}>
                  {creatingInstructor ? 'Creating…' : 'Create instructor'}
                </button>
              </div>
            </form>
          </section>
          <section className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginTop: 0 }}>Instructor list</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-muted-soft)', marginBottom: 12 }}>
              All instructors in your school. Use them when assigning bookings.
            </p>
            {instructors.length === 0 ? (
              <p>No instructors yet. Create one above.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {instructors.map((inst) => (
                  <li key={inst.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                    {inst.email}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginTop: 0 }}>All students</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-muted-soft)', marginBottom: 12 }}>
              All students in your school.
            </p>
            {students.length === 0 ? (
              <p>No students yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {students.map((s) => (
                  <li key={s.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                    {s.email}
                    <span style={{ marginLeft: 8, fontSize: '0.875rem', color: 'var(--color-muted-soft)' }}>
                      {s.approved ? '(approved)' : '(pending)'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card">
          <h2 style={{ marginTop: 0 }}>Pending students</h2>
          <ul style={{ listStyle: 'none' }}>
            {pending.map((s) => (
              <li key={s.id} style={{ marginBottom: 8 }}>
                {s.email}{' '}
                <button onClick={() => handleApprove(s.id, true)}>Approve</button>
              </li>
            ))}
          </ul>
        </section>
        </>
      )}
      {user?.role === 'ADMIN' && (
        <section className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginTop: 0 }}>Audit logs</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-muted-soft)', marginBottom: 12 }}>
            Request ID is shown for each log entry for tracing.
          </p>
          {auditLogs.length === 0 ? (
            <p>No audit logs.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {auditLogs.map((log) => (
                <li
                  key={log.id}
                  style={{
                    padding: '0.5rem 0',
                    borderBottom: '1px solid var(--color-border)',
                    fontSize: '0.875rem',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{log.action}</span> {log.resource}
                  {log.resourceId && <span> — {log.resourceId}</span>}
                  {log.correlationId && (
                    <span style={{ display: 'block', marginTop: 4, color: 'var(--color-muted-soft)' }}>
                      Request ID: {log.correlationId}
                    </span>
                  )}
                  <span style={{ display: 'block', marginTop: 2, color: 'var(--color-muted)' }}>
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {auditTotal > 10 && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                disabled={auditPage <= 1}
                onClick={() => setAuditPage((p) => p - 1)}
              >
                Prev
              </button>
              <span>Page {auditPage} of {Math.ceil(auditTotal / 10)}</span>
              <button
                type="button"
                disabled={auditPage >= Math.ceil(auditTotal / 10)}
                onClick={() => setAuditPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </section>
      )}
      <section className="card">
        <h2>Bookings</h2>
        {bookingsError && (
          <div className="form-message form-message--error" role="alert" style={{ marginBottom: 12 }}>
            {bookingsError}
            <button
              type="button"
              onClick={loadBookings}
              style={{ marginLeft: 8 }}
              aria-label="Retry load bookings"
            >
              Retry
            </button>
          </div>
        )}
        {actionError && (
          <div className="form-message form-message--error" role="alert" style={{ marginBottom: 12 }}>
            {actionError}
          </div>
        )}
        {bookingsLoading ? (
          <p aria-busy="true">Loading bookings…</p>
        ) : bookings.length === 0 ? (
          <p>No bookings.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {bookings.filter((b) => b.id).map((b) => {
              const busy = actionLoadingId === b.id;
              const showAssign = assigningId === b.id;
              return (
                <li
                  key={b.id}
                  style={{
                    marginBottom: 16,
                    padding: 12,
                    border: '1px solid #eee',
                    borderRadius: 4,
                  }}
                >
                  <div style={{ marginBottom: 6 }}>
                    <strong>Booking {b.id}</strong> — {status(b)}
                  </div>
                  <div style={{ fontSize: 14, color: '#555', marginBottom: 6 }}>
                    {b.startAt && new Date(b.startAt).toLocaleString()} –{' '}
                    {b.endAt && new Date(b.endAt).toLocaleString()}
                    {b.student?.email && ` · Student: ${b.student.email}`}
                    {b.instructor?.email && ` · Instructor: ${b.instructor.email}`}
                  </div>
                  {canAct(b) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      {isRequested(b) && (
                        <button
                          type="button"
                          onClick={() => handleApproveBooking(b)}
                          disabled={busy}
                          aria-busy={busy}
                        >
                          {busy ? '…' : 'Approve'}
                        </button>
                      )}
                      {(isRequested(b) || isApproved(b)) && (
                        <>
                          {!showAssign ? (
                            <button
                              type="button"
                              onClick={() => setAssigningId(b.id ?? null)}
                              disabled={busy}
                            >
                              Assign instructor
                            </button>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <select
                                value={assignInstructorId}
                                onChange={(e) => setAssignInstructorId(e.target.value)}
                                className="form-input"
                                style={{ minWidth: 220 }}
                                aria-label="Select instructor"
                              >
                                <option value="">— Select instructor —</option>
                                {instructors.map((inst) => (
                                  <option key={inst.id} value={inst.id}>
                                    {inst.email}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleAssignBooking(b)}
                                disabled={busy || !assignInstructorId.trim()}
                                aria-busy={busy}
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAssigningId(null);
                                  setAssignInstructorId('');
                                  setActionError(null);
                                }}
                                disabled={busy}
                              >
                                Dismiss
                              </button>
                            </span>
                          )}
                        </>
                      )}
                      {isAssigned(b) && (
                        <button
                          type="button"
                          onClick={() => handleCompleteBooking(b)}
                          disabled={busy}
                          aria-busy={busy}
                        >
                          {busy ? '…' : 'Complete'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCancelBooking(b)}
                        disabled={busy}
                        aria-busy={busy}
                      >
                        {busy ? '…' : 'Cancel'}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
