import { z } from "zod";
import type { ChargingSession } from "@/types/dashboard";

/**
 * Validation for raw charging log lines before they are added to the dataset.
 *
 * Expected raw fields (one row = one session attempt):
 *   - vehicle:   e.g. "TT-107"
 *   - charger:   e.g. "Charger-5 Converter" or "charger-4"
 *   - date:      "DD/MM/YYYY" or "YYYY-MM-DD" or "YYYY-MM-DD / YYYY-MM-DD" (cross-midnight)
 *   - startTime: "HH:MM:SS"
 *   - endTime:   "HH:MM:SS"
 *   - startSoC:  integer 0–100
 *   - endSoC:    integer 0–100 (must be >= startSoC)
 *
 * Sessions where chargeAdded === 0 are valid input but should be filtered out
 * downstream per the project's "zero charging session rule".
 */

const VEHICLE_RE = /^TT-\d{3}$/i;
const CHARGER_RE = /^charger-\d+$/i;
const TIME_RE = /^\d{2}:\d{2}:\d{2}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DMY_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const CROSS_MIDNIGHT_RE = /^(\d{4}-\d{2}-\d{2})\s*\/\s*\d{4}-\d{2}-\d{2}$/;

const soc = z
  .number({ invalid_type_error: "SoC must be a number" })
  .int("SoC must be an integer")
  .min(0, "SoC must be >= 0")
  .max(100, "SoC must be <= 100");

export const rawChargingLogSchema = z
  .object({
    vehicle: z
      .string()
      .trim()
      .nonempty("vehicle is required")
      .regex(VEHICLE_RE, 'vehicle must look like "TT-107"'),
    charger: z
      .string()
      .trim()
      .nonempty("charger is required")
      .max(60, "charger label too long"),
    date: z
      .string()
      .trim()
      .nonempty("date is required"),
    startTime: z
      .string()
      .trim()
      .regex(TIME_RE, "startTime must be HH:MM:SS"),
    endTime: z
      .string()
      .trim()
      .regex(TIME_RE, "endTime must be HH:MM:SS"),
    startSoC: soc,
    endSoC: soc,
  })
  .refine((d) => d.endSoC >= d.startSoC, {
    message: "endSoC must be >= startSoC",
    path: ["endSoC"],
  });

export type RawChargingLog = z.infer<typeof rawChargingLogSchema>;

export interface NormalizedChargingLog {
  vehicleId: string; // "tt-107"
  chargerId: string; // "charger-5"
  date: string; // ISO "YYYY-MM-DD" (start date)
  startTime: string;
  endTime: string;
  startSoC: number;
  endSoC: number;
  chargeAdded: number;
  duration: number; // minutes
  chargingSpeed: number; // %SoC / min
  crossesMidnight: boolean;
}

function normalizeVehicleId(v: string): string {
  return v.trim().toLowerCase();
}

/** Extract "charger-N" from labels like "Charger-5 Converter". */
function normalizeChargerId(c: string): string | null {
  const m = c.trim().toLowerCase().match(/charger-\d+/);
  return m ? m[0] : null;
}

/** Returns ISO start date and whether the session crosses midnight. */
function normalizeDate(raw: string): { iso: string; crossesMidnight: boolean } | null {
  const s = raw.trim();
  if (ISO_DATE_RE.test(s)) return { iso: s, crossesMidnight: false };

  const cross = s.match(CROSS_MIDNIGHT_RE);
  if (cross) return { iso: cross[1], crossesMidnight: true };

  const dmy = s.match(DMY_DATE_RE);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return { iso: `${yyyy}-${mm}-${dd}`, crossesMidnight: false };
  }
  return null;
}

function diffMinutes(date: string, start: string, end: string): number {
  const s = new Date(`${date}T${start}`);
  let e = new Date(`${date}T${end}`);
  if (e.getTime() < s.getTime()) {
    e = new Date(e.getTime() + 24 * 60 * 60 * 1000);
  }
  return (e.getTime() - s.getTime()) / 60000;
}

export interface ValidationIssue {
  index: number;
  field?: string;
  message: string;
  raw: unknown;
}

export interface ValidationResult {
  valid: NormalizedChargingLog[];
  invalid: ValidationIssue[];
  /** Subset of `valid` with chargeAdded > 0 — what should actually be added. */
  toInsert: NormalizedChargingLog[];
  /** Subset of `valid` with chargeAdded === 0 — dropped per zero-session rule. */
  zeroFiltered: NormalizedChargingLog[];
}

/**
 * Validate a batch of raw log rows. Returns structured valid + invalid lists
 * instead of throwing, so callers can surface errors before mutating the dataset.
 */
export function validateChargingLogs(rows: unknown[]): ValidationResult {
  const valid: NormalizedChargingLog[] = [];
  const invalid: ValidationIssue[] = [];

  rows.forEach((row, index) => {
    const parsed = rawChargingLogSchema.safeParse(row);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        invalid.push({
          index,
          field: issue.path.join("."),
          message: issue.message,
          raw: row,
        });
      }
      return;
    }

    const data = parsed.data;
    const chargerId = normalizeChargerId(data.charger);
    if (!chargerId) {
      invalid.push({
        index,
        field: "charger",
        message: `charger must contain "charger-N", got "${data.charger}"`,
        raw: row,
      });
      return;
    }

    const dateInfo = normalizeDate(data.date);
    if (!dateInfo) {
      invalid.push({
        index,
        field: "date",
        message: `date must be DD/MM/YYYY, YYYY-MM-DD, or "YYYY-MM-DD / YYYY-MM-DD", got "${data.date}"`,
        raw: row,
      });
      return;
    }

    const duration = diffMinutes(dateInfo.iso, data.startTime, data.endTime);
    if (!Number.isFinite(duration) || duration <= 0) {
      invalid.push({
        index,
        field: "endTime",
        message: "duration must be > 0 minutes",
        raw: row,
      });
      return;
    }

    const chargeAdded = data.endSoC - data.startSoC;
    valid.push({
      vehicleId: normalizeVehicleId(data.vehicle),
      chargerId,
      date: dateInfo.iso,
      startTime: data.startTime,
      endTime: data.endTime,
      startSoC: data.startSoC,
      endSoC: data.endSoC,
      chargeAdded,
      duration: Math.round(duration * 10) / 10,
      chargingSpeed: Math.round((chargeAdded / duration) * 100) / 100,
      crossesMidnight: dateInfo.crossesMidnight,
    });
  });

  const toInsert = valid.filter((v) => v.chargeAdded > 0);
  const zeroFiltered = valid.filter((v) => v.chargeAdded === 0);

  return { valid, invalid, toInsert, zeroFiltered };
}

/**
 * Convert a normalized log into the ChargingSession shape used by the dataset.
 * Caller supplies the desired `id` (e.g. "s422").
 */
export function toChargingSession(
  log: NormalizedChargingLog,
  id: string,
): ChargingSession {
  return {
    id,
    vehicleId: log.vehicleId,
    chargerId: log.chargerId,
    date: log.date,
    startTime: log.startTime,
    endTime: log.endTime,
    startSoC: log.startSoC,
    endSoC: log.endSoC,
    chargeAdded: log.chargeAdded,
    chargingSpeed: log.chargingSpeed,
    duration: log.duration,
  };
}
