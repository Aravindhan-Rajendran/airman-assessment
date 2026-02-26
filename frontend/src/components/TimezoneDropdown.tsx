'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { getTimezoneList } from '@/lib/timezones-list';
import { getTimezoneShortLabel } from '@/lib/timezone';

const DROPDOWN_ID = 'timezone-dropdown';
const SEARCH_ID = 'timezone-search';

type TimezoneDropdownProps = {
  value: string;
  onChange: (timezone: string) => void;
  id?: string;
  label?: string;
  'aria-label'?: string;
  disabled?: boolean;
  className?: string;
};

export function TimezoneDropdown({
  value,
  onChange,
  id = DROPDOWN_ID,
  label = 'Timezone',
  'aria-label': ariaLabel = 'Select timezone',
  disabled = false,
  className = '',
}: TimezoneDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const list = useMemo(() => getTimezoneList(value), [value]);
  const filtered = useMemo(() => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((tz) => tz.toLowerCase().includes(q));
  }, [list, search]);

  const shortLabel = useMemo(() => getTimezoneShortLabel(value), [value]);

  useEffect(() => {
    if (!open) return;
    setHighlightIndex(0);
    setSearch('');
  }, [open]);

  useEffect(() => {
    if (!open || highlightIndex < 0 || highlightIndex >= filtered.length) return;
    listRef.current?.querySelectorAll('li')[highlightIndex]?.scrollIntoView({ block: 'nearest' });
  }, [open, highlightIndex, filtered.length]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleSelect = (tz: string) => {
    onChange(tz);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % Math.max(1, filtered.length));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => (i - 1 + filtered.length) % Math.max(1, filtered.length));
      return;
    }
    if (e.key === 'Enter' && filtered[highlightIndex]) {
      e.preventDefault();
      handleSelect(filtered[highlightIndex]);
      return;
    }
    if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`timezone-dropdown ${className}`.trim()}
      style={{ position: 'relative' }}
    >
      {label && (
        <label id={`${id}-label`} htmlFor={id} className="timezone-dropdown__label">
          {label}
        </label>
      )}
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label ? `${id}-label` : undefined}
        aria-describedby={open ? SEARCH_ID : undefined}
        aria-activedescendant={open && filtered[highlightIndex] ? `${id}-option-${highlightIndex}` : undefined}
        disabled={disabled}
        className="timezone-dropdown__trigger"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
      >
        <span className="timezone-dropdown__trigger-value">
          <span className="timezone-dropdown__trigger-short">{shortLabel}</span>
          <span className="timezone-dropdown__trigger-full">{value}</span>
        </span>
        <span className="timezone-dropdown__chevron" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="timezone-dropdown__panel" role="presentation">
          <input
            id={SEARCH_ID}
            type="text"
            placeholder="Search timezones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
                const next = (e.target as HTMLInputElement).parentElement?.querySelector('button');
                next?.focus();
              }
            }}
            className="timezone-dropdown__search"
            aria-label="Filter timezones"
          />
          <ul
            ref={listRef}
            role="listbox"
            aria-label={ariaLabel}
            className="timezone-dropdown__list"
            style={{ maxHeight: 240, overflowY: 'auto' }}
          >
            {filtered.length === 0 ? (
              <li className="timezone-dropdown__empty">No timezones match</li>
            ) : (
              filtered.map((tz, i) => (
                <li
                  key={tz}
                  role="option"
                  id={`${id}-option-${i}`}
                  aria-selected={tz === value}
                  className={`timezone-dropdown__option ${i === highlightIndex ? 'timezone-dropdown__option--highlight' : ''} ${tz === value ? 'timezone-dropdown__option--selected' : ''}`}
                  onClick={() => handleSelect(tz)}
                  onMouseEnter={() => setHighlightIndex(i)}
                >
                  <span className="timezone-dropdown__option-label">{tz}</span>
                  <span className="timezone-dropdown__option-abbr">{getTimezoneShortLabel(tz)}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
