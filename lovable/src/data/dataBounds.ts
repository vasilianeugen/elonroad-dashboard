import { sessionData } from "@/data/vehicleData";

/**
 * Single source of truth for the dataset's date bounds.
 *
 * Derived directly from `sessionData` so the header label, DateRangeControl
 * bounds, and any "now" reference can never drift apart from the data.
 *
 * Date strings in `sessionData` are ISO "YYYY-MM-DD" — sortable as strings.
 */
function parseISODate(iso: string): Date {
  // Use noon to avoid timezone shifting (project rule).
  return new Date(`${iso}T12:00:00`);
}

const sortedDates = sessionData.map((s) => s.date).sort();

export const DATA_START_ISO = sortedDates[0];
export const DATA_END_ISO = sortedDates[sortedDates.length - 1];

export const DATA_START_DATE = parseISODate(DATA_START_ISO);
export const DATA_END_DATE = parseISODate(DATA_END_ISO);

/** Format an ISO date as "DD.MM.YYYY" for the header label. */
export function formatPeriodDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Header period string, e.g. "17.12.2025 - 21.04.2026". */
export const PERIOD_LABEL = `${formatPeriodDate(DATA_START_ISO)} - ${formatPeriodDate(DATA_END_ISO)}`;
