/**
 * Timezone utilities for consistent, user-friendly display and validation.
 * All API times are UTC (ISO 8601); we show and collect in the user's local timezone.
 */

/** User's timezone (e.g. "America/New_York") */
export function getUserTimezone(): string {
  if (typeof Intl === 'undefined' || !Intl.DateTimeFormat) return 'UTC';
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Short label for timezone (e.g. "EST", "PST") */
export function getTimezoneShortLabel(tz: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    return tzPart?.value ?? tz.split('/').pop() ?? tz;
  } catch {
    return tz;
  }
}

/** Format a UTC ISO string to local date & time with timezone hint */
export function formatInLocal(
  isoUtc: string | undefined,
  options: { dateStyle?: 'short' | 'medium'; timeStyle?: 'short'; showTz?: boolean; timeZone?: string } = {}
): string {
  if (!isoUtc) return '—';
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return isoUtc;
  const tz = options.timeZone ?? getUserTimezone();
  const dateStyle = options.dateStyle ?? 'short';
  const timeStyle = options.timeStyle ?? 'short';
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    dateStyle,
    timeStyle,
    hour12: true,
  }).format(d);
  if (options.showTz !== false) {
    const tzLabel = getTimezoneShortLabel(tz);
    return `${formatted} (${tzLabel})`;
  }
  return formatted;
}

/** Format for list items: "Feb 26, 2026, 4:56 AM – Feb 28, 2026, 4:50 AM (EST)" */
export function formatBookingRange(
  startAt: string | undefined,
  endAt: string | undefined,
  timeZone?: string
): string {
  if (!startAt || !endAt) return '—';
  const tz = timeZone ?? getUserTimezone();
  const start = formatInLocal(startAt, { showTz: false, timeZone: tz });
  const end = formatInLocal(endAt, { showTz: false, timeZone: tz });
  const tzLabel = getTimezoneShortLabel(tz);
  return `${start} – ${end} (${tzLabel})`;
}

/** Validation result for booking request */
export type BookingValidation = {
  valid: boolean;
  error?: string;
};

/** Validate requested / start / end datetimes (local values from datetime-local inputs) */
export function validateBookingTimes(
  requestedAt: string,
  startAt: string,
  endAt: string
): BookingValidation {
  if (!requestedAt.trim() || !startAt.trim() || !endAt.trim()) {
    return { valid: false, error: 'Please fill in all date and time fields.' };
  }
  const req = new Date(requestedAt);
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(req.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { valid: false, error: 'Invalid date or time format.' };
  }
  if (end.getTime() <= start.getTime()) {
    return { valid: false, error: 'Preferred end must be after preferred start.' };
  }
  if (start.getTime() < req.getTime()) {
    return { valid: false, error: 'Preferred start cannot be before the request time.' };
  }
  return { valid: true };
}
