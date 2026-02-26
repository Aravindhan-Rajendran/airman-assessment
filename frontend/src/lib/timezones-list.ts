/**
 * IANA timezone identifiers for dropdown.
 * Uses Intl.supportedValuesOf when available, otherwise a curated list.
 */
function getSupportedTimeZones(): string[] {
  if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
    try {
      return (Intl as unknown as { supportedValuesOf(key: string): string[] }).supportedValuesOf('timeZone');
    } catch {
      // fall through to static list
    }
  }
  return STATIC_TIMEZONES;
}

/** Curated list of common IANA timezones (fallback when supportedValuesOf is unavailable) */
const STATIC_TIMEZONES = [
  'UTC',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'America/Anchorage',
  'America/Argentina/Buenos_Aires',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/New_York',
  'America/Phoenix',
  'America/Sao_Paulo',
  'America/Toronto',
  'America/Vancouver',
  'Asia/Bangkok',
  'Asia/Dubai',
  'Asia/Hong_Kong',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Melbourne',
  'Australia/Perth',
  'Australia/Sydney',
  'Europe/Amsterdam',
  'Europe/Berlin',
  'Europe/London',
  'Europe/Moscow',
  'Europe/Paris',
  'Europe/Rome',
  'Pacific/Auckland',
  'Pacific/Fiji',
  'Pacific/Guam',
];

let cachedList: string[] | null = null;

/** Returns sorted list of timezone identifiers, with UTC first and user's zone in list */
export function getTimezoneList(ensureInList?: string): string[] {
  if (!cachedList) {
    const raw = getSupportedTimeZones();
    const set = new Set(raw);
    if (ensureInList && !set.has(ensureInList)) set.add(ensureInList);
    cachedList = Array.from(set).sort((a, b) => {
      if (a === 'UTC') return -1;
      if (b === 'UTC') return 1;
      return a.localeCompare(b);
    });
  }
  if (ensureInList && !cachedList.includes(ensureInList)) {
    cachedList = [ensureInList, ...cachedList.filter((t) => t !== ensureInList)].sort((a, b) => {
      if (a === 'UTC') return -1;
      if (b === 'UTC') return 1;
      return a.localeCompare(b);
    });
  }
  return cachedList;
}

/** Reset cache (e.g. for tests) */
export function resetTimezoneListCache(): void {
  cachedList = null;
}
