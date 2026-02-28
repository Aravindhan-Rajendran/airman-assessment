'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRequireAuth } from '@/context/AuthContext';
import { schedulingApi, type Booking, type InstructorAvailability } from '@/lib/api';
import {
  getUserTimezone,
  getTimezoneShortLabel,
  formatBookingRange,
  formatInLocal,
} from '@/lib/timezone';
import { bookingRequestSchema, availabilitySchema, type BookingRequestFormData, type AvailabilityFormData } from '@/lib/validations';
import { TimezoneDropdown } from '@/components/TimezoneDropdown';

const LIMIT = 10;

/** Format Date for datetime-local min attribute (no past dates/times). */
function toDatetimeLocalMin(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
  const [availability, setAvailability] = useState<InstructorAvailability[]>([]);
  const [timezone, setTimezone] = useState('UTC');
  const [submitting, setSubmitting] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useEffect(() => {
    setTimezone(getUserTimezone());
  }, []);

  const displayTz = timezone;
  const displayTzLabel = useMemo(() => getTimezoneShortLabel(displayTz), [displayTz]);
  const minDatetime = toDatetimeLocalMin(new Date());

  const bookingForm = useForm<BookingRequestFormData>({
    resolver: zodResolver(bookingRequestSchema),
    defaultValues: { name: '', requestedAt: '', startAt: '', endAt: '' },
    mode: 'onBlur',
  });

  const availabilityForm = useForm<AvailabilityFormData>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: { startAt: '', endAt: '' },
    mode: 'onBlur',
  });

  const loadBookings = (pageOverride?: number) => {
    const pageToLoad = pageOverride ?? page;
    setError(null);
    schedulingApi.listBookings({ page: pageToLoad, limit: LIMIT })
      .then((r) => {
        setBookings(Array.isArray(r.data) ? r.data : []);
        setTotal(r.total ?? 0);
        if (pageOverride != null) setPage(pageOverride);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load schedule');
      });
  };

  const refetchWeekly = () => {
    schedulingApi.weeklyBookings(weekStart)
      .then((r) => setWeekly(Array.isArray(r.data) ? r.data : []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load weekly view'));
  };

  useEffect(() => { loadBookings(); }, [page]);

  const isInstructor = user?.role === 'INSTRUCTOR';
  const isInstructorOrAdmin = user?.role === 'INSTRUCTOR' || user?.role === 'ADMIN';

  // Weekly view: only fetch for admin and student (not instructor)
  useEffect(() => {
    if (isInstructor) return;
    setError(null);
    schedulingApi.weeklyBookings(weekStart)
      .then((r) => setWeekly(Array.isArray(r.data) ? r.data : []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load weekly view'));
  }, [weekStart, isInstructor]);

  // Instructor: load their availability slots
  const loadAvailability = () => {
    if (!isInstructor) return;
    setError(null);
    schedulingApi.listAvailability({ page: 1, limit: 100 })
      .then((r) => {
        const slots = Array.isArray(r.data) ? r.data : [];
        setAvailability(slots.filter((s) => s.instructorId === user?.id));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load availability'));
  };

  useEffect(() => {
    if (isInstructor) loadAvailability();
  }, [isInstructor, user?.id]);

  // When instructor/admin: refetch all bookings and weekly view on tab focus so student updates appear
  useEffect(() => {
    if (!isInstructorOrAdmin) return;
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadBookings();
        if (!isInstructor) refetchWeekly();
        if (isInstructor) loadAvailability();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isInstructorOrAdmin, isInstructor]);

  // When instructor/admin: poll so new/updated student bookings show without refresh
  useEffect(() => {
    if (!isInstructorOrAdmin) return;
    const POLL_MS = 15000;
    const id = setInterval(() => {
      loadBookings();
      if (!isInstructor) refetchWeekly();
      if (isInstructor) loadAvailability();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [isInstructorOrAdmin, isInstructor]);

  const onRequestBooking = bookingForm.handleSubmit(async (data) => {
    setSubmitting(true);
    setError(null);
    try {
      const created = await schedulingApi.createBooking(
        data.name.trim(),
        new Date(data.requestedAt).toISOString(),
        new Date(data.startAt).toISOString(),
        new Date(data.endAt).toISOString()
      );
      bookingForm.reset();
      // Optimistic update: show new slot immediately in All bookings and Weekly view
      const newBooking: Booking = {
        id: created.id,
        name: created.name ?? data.name.trim(),
        startAt: created.startAt ?? data.startAt,
        endAt: created.endAt ?? data.endAt,
        status: created.status ?? 'REQUESTED',
      };
      setBookings((prev) => [newBooking, ...prev]);
      setTotal((t) => t + 1);
      const weekStartDate = new Date(weekStart);
      const weekEnd = new Date(weekStartDate);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const start = new Date(newBooking.startAt ?? data.startAt);
      if (start >= weekStartDate && start < weekEnd) {
        setWeekly((prev) =>
          [newBooking, ...prev].sort(
            (a, b) => new Date(a.startAt ?? 0).getTime() - new Date(b.startAt ?? 0).getTime()
          )
        );
      }
      // Switch to page 1 so the new booking is visible; refetch when already on page 1
      if (page === 1) {
        loadBookings(1);
      } else {
        setPage(1);
      }
      if (!isInstructor) refetchWeekly();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request booking');
    } finally {
      setSubmitting(false);
    }
  });

  const onAddAvailability = availabilityForm.handleSubmit(async (data) => {
    setSubmitting(true);
    setError(null);
    try {
      await schedulingApi.addAvailability(
        new Date(data.startAt).toISOString(),
        new Date(data.endAt).toISOString()
      );
      availabilityForm.reset();
      loadAvailability();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add availability');
    } finally {
      setSubmitting(false);
    }
  });

  const isStudent = user?.role === 'STUDENT';
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const canAcceptBooking = (b: Booking) =>
    (b.status === 'REQUESTED' || b.status === 'APPROVED') && !b.instructorId;

  const onAcceptBooking = async (bookingId: string) => {
    setAcceptingId(bookingId);
    setError(null);
    try {
      await schedulingApi.acceptBooking(bookingId);
      loadBookings();
      refetchWeekly();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept booking');
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <div className="schedule-page">
      <header className="schedule-header">
        <h1 className="schedule-header__title">Schedule</h1>
        <div className="schedule-header__tz">
          <TimezoneDropdown
            id="schedule-timezone"
            label="Display timezone"
            value={displayTz}
            onChange={setTimezone}
            className="schedule-header__tz-dropdown"
          />
          <p className="schedule-header__tz-hint">All times on this page use the selected timezone.</p>
        </div>
      </header>

      {error && (
        <div className="schedule-message schedule-message--error" role="alert">
          {error}
        </div>
      )}

      {isStudent && (
        <section className="card schedule-card schedule-card--request" aria-labelledby="request-booking-title">
          <h2 id="request-booking-title" className="schedule-card__title">Request a booking</h2>
          <p className="schedule-card__description">
            Choose when you want a training slot. Your school will approve or assign an instructor.
          </p>
          <form onSubmit={onRequestBooking} className="schedule-form" noValidate>
            <div className={`schedule-form__field ${bookingForm.formState.errors.name ? 'form-field--error' : ''}`}>
              <label htmlFor="name">Booking name <span className="form-required">*</span></label>
              <input
                id="name"
                type="text"
                placeholder="e.g. Instrument training"
                {...bookingForm.register('name')}
                className="schedule-form__input"
                aria-invalid={!!bookingForm.formState.errors.name}
                aria-describedby={bookingForm.formState.errors.name ? 'name-error' : 'name-hint'}
              />
              {bookingForm.formState.errors.name && (
                <span id="name-error" className="form-field__error" role="alert">
                  {bookingForm.formState.errors.name.message}
                </span>
              )}
              {!bookingForm.formState.errors.name && (
                <span id="name-hint" className="schedule-form__hint">Helps you tell this booking apart from others</span>
              )}
            </div>
            <div className={`schedule-form__field ${bookingForm.formState.errors.requestedAt ? 'form-field--error' : ''}`}>
              <label htmlFor="requestedAt">When you are requesting (date & time) <span className="form-required">*</span></label>
              <input
                id="requestedAt"
                type="datetime-local"
                min={minDatetime}
                {...bookingForm.register('requestedAt')}
                className="schedule-form__input"
                aria-invalid={!!bookingForm.formState.errors.requestedAt}
                aria-describedby={bookingForm.formState.errors.requestedAt ? 'requestedAt-error' : 'requestedAt-hint'}
              />
              {bookingForm.formState.errors.requestedAt && (
                <span id="requestedAt-error" className="form-field__error" role="alert">
                  {bookingForm.formState.errors.requestedAt.message}
                </span>
              )}
              {!bookingForm.formState.errors.requestedAt && (
                <span id="requestedAt-hint" className="schedule-form__hint">Current moment or when you submit</span>
              )}
            </div>
            <div className={`schedule-form__field ${bookingForm.formState.errors.startAt ? 'form-field--error' : ''}`}>
              <label htmlFor="startAt">Preferred start (date & time) <span className="form-required">*</span></label>
              <input
                id="startAt"
                type="datetime-local"
                min={minDatetime}
                {...bookingForm.register('startAt')}
                className="schedule-form__input"
                aria-invalid={!!bookingForm.formState.errors.startAt}
                aria-describedby={bookingForm.formState.errors.startAt ? 'startAt-error' : 'startAt-hint'}
              />
              {bookingForm.formState.errors.startAt && (
                <span id="startAt-error" className="form-field__error" role="alert">
                  {bookingForm.formState.errors.startAt.message}
                </span>
              )}
              {!bookingForm.formState.errors.startAt && (
                <span id="startAt-hint" className="schedule-form__hint">Start of your preferred slot</span>
              )}
            </div>
            <div className={`schedule-form__field ${bookingForm.formState.errors.endAt ? 'form-field--error' : ''}`}>
              <label htmlFor="endAt">Preferred end (date & time) <span className="form-required">*</span></label>
              <input
                id="endAt"
                type="datetime-local"
                {...bookingForm.register('endAt')}
                className="schedule-form__input"
                aria-invalid={!!bookingForm.formState.errors.endAt}
                aria-describedby={bookingForm.formState.errors.endAt ? 'endAt-error' : 'endAt-hint'}
              />
              {bookingForm.formState.errors.endAt && (
                <span id="endAt-error" className="form-field__error" role="alert">
                  {bookingForm.formState.errors.endAt.message}
                </span>
              )}
              {!bookingForm.formState.errors.endAt && (
                <span id="endAt-hint" className="schedule-form__hint">End must be after start</span>
              )}
            </div>
            <button type="submit" disabled={submitting} className="schedule-form__submit">
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
          </form>
        </section>
      )}

      {user?.role === 'INSTRUCTOR' && (
        <section className="card schedule-card" aria-labelledby="add-availability-title">
          <h2 id="add-availability-title" className="schedule-card__title">Add availability</h2>
          <p className="schedule-card__description">Set when you are available for bookings.</p>
          <form onSubmit={onAddAvailability} className="schedule-form" noValidate>
            <div className={`schedule-form__field ${availabilityForm.formState.errors.startAt ? 'form-field--error' : ''}`}>
              <label htmlFor="availStart">Start (date & time) <span className="form-required">*</span></label>
              <input
                id="availStart"
                type="datetime-local"
                min={minDatetime}
                {...availabilityForm.register('startAt')}
                className="schedule-form__input"
                aria-invalid={!!availabilityForm.formState.errors.startAt}
                aria-describedby={availabilityForm.formState.errors.startAt ? 'availStart-error' : undefined}
              />
              {availabilityForm.formState.errors.startAt && (
                <span id="availStart-error" className="form-field__error" role="alert">
                  {availabilityForm.formState.errors.startAt.message}
                </span>
              )}
            </div>
            <div className={`schedule-form__field ${availabilityForm.formState.errors.endAt ? 'form-field--error' : ''}`}>
              <label htmlFor="availEnd">End (date & time) <span className="form-required">*</span></label>
              <input
                id="availEnd"
                type="datetime-local"
                min={minDatetime}
                {...availabilityForm.register('endAt')}
                className="schedule-form__input"
                aria-invalid={!!availabilityForm.formState.errors.endAt}
                aria-describedby={availabilityForm.formState.errors.endAt ? 'availEnd-error' : undefined}
              />
              {availabilityForm.formState.errors.endAt && (
                <span id="availEnd-error" className="form-field__error" role="alert">
                  {availabilityForm.formState.errors.endAt.message}
                </span>
              )}
            </div>
            <button type="submit" disabled={submitting} className="schedule-form__submit">Add availability</button>
          </form>
        </section>
      )}

      {isInstructor && (
        <section className="card schedule-card" aria-labelledby="your-availability-title">
          <h2 id="your-availability-title" className="schedule-card__title">Your availability</h2>
          <p className="schedule-card__description">Your current availability slots (times in {displayTzLabel}).</p>
          <div className="schedule-table-wrap">
            {availability.length === 0 ? (
              <p className="schedule-table-empty">No availability slots yet. Add one above.</p>
            ) : (
              <table className="schedule-table" aria-label="Your availability slots">
                <thead>
                  <tr>
                    <th scope="col">Start – End</th>
                  </tr>
                </thead>
                <tbody>
                  {availability.map((slot) => (
                    <tr key={slot.id}>
                      <td className="schedule-table__range">
                        {formatBookingRange(slot.startAt, slot.endAt, displayTz)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {!isInstructor && (
      <section className="schedule-section" aria-labelledby="weekly-view-title">
        <h2 id="weekly-view-title" className="schedule-section__title">Weekly view</h2>
        <p className="schedule-section__hint">Week starting (times in {displayTzLabel}).</p>
        <div className="schedule-week-picker">
          <label htmlFor="weekStart" className="schedule-week-picker__label">Week starting</label>
          <input
            id="weekStart"
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="schedule-form__input schedule-week-picker__input"
            aria-describedby="weekly-view-title"
          />
        </div>
        <div className="schedule-table-wrap">
          {weekly.length === 0 ? (
            <p className="schedule-table-empty">No bookings this week.</p>
          ) : (
            <table className="schedule-table" aria-label="Bookings for the selected week">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Start – End</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {weekly.map((b) => (
                  <tr key={b.id}>
                    <td>{b.name ?? '—'}</td>
                    <td className="schedule-table__range">{formatBookingRange(b.startAt, b.endAt, displayTz)}</td>
                    <td>
                      <span className={`schedule-list__status schedule-list__status--${(b.status ?? '').toLowerCase()}`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
      )}

      <section className="schedule-section" aria-labelledby="all-bookings-title">
        <h2 id="all-bookings-title" className="schedule-section__title">All bookings</h2>
        <p className="schedule-section__hint">Paginated list (times in {displayTzLabel}).</p>
        <div className="schedule-table-wrap">
          {bookings.length === 0 ? (
            <p className="schedule-table-empty">No bookings yet.</p>
          ) : (
            <table className="schedule-table" aria-label="All your bookings">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Start</th>
                  <th scope="col">Status</th>
                  {isInstructor && <th scope="col">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>{b.name ?? '—'}</td>
                    <td className="schedule-table__range">
                      {b.startAt ? formatInLocal(b.startAt, { showTz: true, timeZone: displayTz }) : '—'}
                    </td>
                    <td>
                      <span className={`schedule-list__status schedule-list__status--${(b.status ?? '').toLowerCase()}`}>
                        {b.status}
                      </span>
                    </td>
                    {isInstructor && (
                      <td>
                        {canAcceptBooking(b) && (
                          <button
                            type="button"
                            className="schedule-form__submit"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                            disabled={acceptingId === b.id}
                            onClick={() => b.id && onAcceptBooking(b.id)}
                          >
                            {acceptingId === b.id ? 'Accepting…' : 'Assign to me'}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <nav className="schedule-pagination" aria-label="Bookings pagination">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="schedule-pagination__btn"
            aria-label="Previous page"
          >
            Previous
          </button>
          <span className="schedule-pagination__info" aria-live="polite">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="schedule-pagination__btn"
            aria-label="Next page"
          >
            Next
          </button>
        </nav>
      </section>
    </div>
  );
}
