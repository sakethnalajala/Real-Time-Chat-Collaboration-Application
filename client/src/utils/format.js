import { format, formatDistanceToNowStrict, isThisWeek, isThisYear, isToday, isYesterday } from 'date-fns';

const toDate = (value) => (value instanceof Date ? value : new Date(value));

export const formatTime = (value) => format(toDate(value), 'p');

/** Compact timestamp for conversation lists. */
export function formatListTime(value) {
  if (!value) return '';
  const date = toDate(value);
  if (isToday(date)) return format(date, 'p');
  if (isYesterday(date)) return 'Yesterday';
  if (isThisWeek(date, { weekStartsOn: 1 })) return format(date, 'EEE');
  if (isThisYear(date)) return format(date, 'MMM d');
  return format(date, 'dd/MM/yy');
}

export function formatDayLabel(value) {
  const date = toDate(value);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isThisYear(date)) return format(date, 'EEEE, MMMM d');
  return format(date, 'MMMM d, yyyy');
}

export function formatLastSeen(value) {
  if (!value) return 'Offline';
  const date = toDate(value);
  const minutes = (Date.now() - date.getTime()) / 60_000;
  if (minutes < 1) return 'Last seen just now';
  if (minutes < 60) return `Last seen ${Math.floor(minutes)} min ago`;
  if (isToday(date)) return `Last seen today at ${format(date, 'p')}`;
  if (isYesterday(date)) return `Last seen yesterday at ${format(date, 'p')}`;
  if (isThisYear(date)) return `Last seen ${format(date, 'MMM d')} at ${format(date, 'p')}`;
  return `Last seen ${format(date, 'MMM d, yyyy')}`;
}

export const formatRelative = (value) => (value ? formatDistanceToNowStrict(toDate(value), { addSuffix: true }) : '');

export const formatDate = (value, pattern = 'MMM d, yyyy') => (value ? format(toDate(value), pattern) : '—');

export const formatDateTime = (value) => (value ? format(toDate(value), 'MMM d, yyyy · p') : '—');

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

export const formatNumber = (value) => new Intl.NumberFormat().format(value ?? 0);

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

export const firstName = (name = '') => name.split(/\s+/)[0] || name;

export const pluralize = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
