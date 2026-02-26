'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRequireAuth } from '@/context/AuthContext';
import { schedulingApi, type Booking } from '@/lib/api';
import {
  getUserTimezone,
  getTimezoneShortLabel,
  formatBookingRange,
  formatInLocal,
} from '@/lib/timezone';
import { bookingRequestSchema, availabilitySchema, type BookingRequestFormData, type AvailabilityFormData } from '@/lib/validations';
import { TimezoneDropdown } from '@/components/TimezoneDropdown';

const LIMIT = 10;

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
  const [timezone, setTimezone] = useState('UTC');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setTimezone(getUserTimezone());
  }, []);

  const displayTz = timezone;
  const displayTzLabel = useMemo(() => getTimezoneShortLabel(displayTz), [displayTz]);

  const bookingForm = useForm<BookingRequestFormData>({
    resolver: zodResolver(bookingRequestSchema),
    defaultValues: { requestedAt: '', startAt: '', endAt: '' },
    mode: 'onBlur',
  });

  const availabilityForm = useForm<AvailabilityFormData>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: { startAt: '', endAt: '' },
    mode: 'onBlur',
  });

  const loadBookings = () => {
    setError(null);
    schedulingApi.listBookings({ page, limit: LIMIT })
      .then((r) => {
        setBookings(Array.isArray(r.data) ? r.data : []);
        setTotal(r.total ?? 0);
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

  const onRequestBooking = bookingForm.handleSubmit(async (data) => {
    setSubmitting(true);
    setError(null);
    try {
      await schedulingApi.createBooking(
        new Date(data.requestedAt).toISOString(),
        new Date(data.startAt).toISOString(),
        new Date(data.endAt).toISOString()
      );
      bookingForm.reset();
      loadBookings();
      schedulingApi.weeklyBookings(weekStart).then((r) => setWeekly(Array.isArray(r.data) ? r.data : []));
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add availability');
    } finally {
      setSubmitting(false);
    }
  });

  const isStudent = user?.role === 'STUDENT';
  const isInstructorOrAdmin = user?.role === 'INSTRUCTOR' || user?.role === 'ADMIN';
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

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
            <div className={`schedule-form__field ${bookingForm.formState.errors.requestedAt ? 'form-field--error' : ''}`}>
              <label htmlFor="requestedAt">When you are requesting (date & time) <span className="form-required">*</span></label>
              <input
                id="requestedAt"
                type="datetime-local"
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

      {isInstructorOrAdmin && (
        <section className="card schedule-card" aria-labelledby="add-availability-title">
          <h2 id="add-availability-title" className="schedule-card__title">Add availability</h2>
          <p className="schedule-card__description">Set when you are available for bookings.</p>
          <form onSubmit={onAddAvailability} className="schedule-form" noValidate>
            <div className={`schedule-form__field ${availabilityForm.formState.errors.startAt ? 'form-field--error' : ''}`}>
              <label htmlFor="availStart">Start (date & time) <span className="form-required">*</span></label>
              <input
                id="availStart"
                type="datetime-local"
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
                  <th scope="col">Start – End</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {weekly.map((b) => (
                  <tr key={b.id}>
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
                  <th scope="col">Start</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td className="schedule-table__range">
                      {b.startAt ? formatInLocal(b.startAt, { showTz: true, timeZone: displayTz }) : '—'}
                    </td>
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
