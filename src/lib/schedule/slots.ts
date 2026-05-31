// Cadence → concrete time slots.
//
// The Schedule tab lets a user define a weekly posting cadence (which weekdays
// + which times of day). This turns that cadence into the next N concrete
// Date objects in the user's local timezone, which the client serializes to ISO
// strings for the autofill endpoint. WoopSocial owns the actual publish timer.

export interface Cadence {
  /** 0 = Sunday … 6 = Saturday. */
  days: number[];
  /** "HH:MM" 24h times of day. */
  times: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parses "HH:MM" → [hours, minutes], or null when malformed. */
function parseTime(value: string): [number, number] | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return [h, min];
}

/**
 * Returns up to `max` upcoming slot Dates (ascending) matching the cadence,
 * scanning forward from `from` for `horizonDays`. Slots in the past are skipped.
 */
export function generateSlots(
  cadence: Cadence,
  max: number,
  from: Date = new Date(),
  horizonDays = 60,
): Date[] {
  const times = cadence.times
    .map(parseTime)
    .filter((t): t is [number, number] => t !== null)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const days = new Set(cadence.days);

  if (times.length === 0 || days.size === 0) return [];

  const slots: Date[] = [];
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  for (let d = 0; d < horizonDays && slots.length < max; d++) {
    const day = new Date(start.getTime() + d * DAY_MS);
    if (!days.has(day.getDay())) continue;
    for (const [h, min] of times) {
      if (slots.length >= max) break;
      const slot = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        h,
        min,
        0,
        0,
      );
      if (slot.getTime() > from.getTime() + 60_000) slots.push(slot);
    }
  }
  return slots;
}

export const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
