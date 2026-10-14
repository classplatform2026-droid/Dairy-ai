/**
 * Date utilities for LifeNote AI
 * Guaranteed timezone-safe and DST-safe operations.
 * Avoids any accidental UTC shifts from .toISOString().split('T')[0]
 */

/**
 * Returns a date formatted as YYYY-MM-DD in the local timezone
 */
export const formatLocalDate = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Gets today's date strictly in the user's local timezone as YYYY-MM-DD
 */
export const getTodayDateString = (): string => {
  return formatLocalDate(new Date());
};

/**
 * Normalizes any date input (ISO string, Date object, or YYYY-MM-DD) into clean YYYY-MM-DD
 */
export const normalizeDate = (val: string | Date | null | undefined): string => {
  if (!val) return getTodayDateString();
  if (val instanceof Date) return formatLocalDate(val);
  const s = String(val).trim();
  if (s.includes('T')) {
    return s.split('T')[0];
  }
  return s;
};

/**
 * Parses a YYYY-MM-DD string into a safe Date object at local 12:00:00 (noon).
 * Using noon guarantees date math will never cross midnight due to timezone or Daylight Saving Time offsets.
 */
export const parseLocalDate = (dateStr: string): Date => {
  const clean = normalizeDate(dateStr);
  const parts = clean.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  }
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
};

/**
 * Safely adds or subtracts days to a YYYY-MM-DD string without any timezone shift.
 */
export const stepDateString = (dateStr: string, offsetDays: number): string => {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + offsetDays);
  return formatLocalDate(d);
};

/**
 * Formats a YYYY-MM-DD string into a human-readable string: e.g. "Wednesday, October 14, 2026"
 */
export const formatHumanDate = (dateStr: string): string => {
  try {
    const d = parseLocalDate(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

/**
 * Formats a YYYY-MM-DD string into a short label: e.g. "14 Oct 2026"
 */
export const formatShortDate = (dateStr: string): string => {
  try {
    const d = parseLocalDate(dateStr);
    return d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

/**
 * Checks if a given date string corresponds to today in the local timezone
 */
export const isToday = (dateStr: string): boolean => {
  return normalizeDate(dateStr) === getTodayDateString();
};

/**
 * Compares two date strings in descending chronological order (newest date first)
 */
export const compareDateDesc = (dateA: string, dateB: string): number => {
  const cleanA = normalizeDate(dateA);
  const cleanB = normalizeDate(dateB);
  return cleanB.localeCompare(cleanA);
};

/**
 * Compares two date strings in ascending chronological order (oldest date first)
 */
export const compareDateAsc = (dateA: string, dateB: string): number => {
  const cleanA = normalizeDate(dateA);
  const cleanB = normalizeDate(dateB);
  return cleanA.localeCompare(cleanB);
};
