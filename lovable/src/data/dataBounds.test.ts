import { describe, it, expect } from "vitest";
import { sessionData } from "@/data/vehicleData";
import {
  DATA_START_ISO,
  DATA_END_ISO,
  DATA_START_DATE,
  DATA_END_DATE,
  PERIOD_LABEL,
  formatPeriodDate,
} from "@/data/dataBounds";

/**
 * These tests guarantee that the visible period label and the date-range
 * picker bounds stay in sync with the actual sessionData. If you append
 * sessions for new dates, this test will fail unless dataBounds re-derives
 * the new min/max — preventing the stale "16.04.2026" header bug.
 */
describe("data bounds <-> vehicleData sync", () => {
  const isoDates = sessionData.map((s) => s.date).sort();
  const trueMin = isoDates[0];
  const trueMax = isoDates[isoDates.length - 1];

  it("derives min/max ISO dates from sessionData", () => {
    expect(DATA_START_ISO).toBe(trueMin);
    expect(DATA_END_ISO).toBe(trueMax);
  });

  it("exposes Date objects matching the ISO bounds", () => {
    expect(DATA_START_DATE.toISOString().slice(0, 10)).toBe(trueMin);
    expect(DATA_END_DATE.toISOString().slice(0, 10)).toBe(trueMax);
  });

  it("formats the period label as DD.MM.YYYY - DD.MM.YYYY", () => {
    expect(PERIOD_LABEL).toBe(`${formatPeriodDate(trueMin)} - ${formatPeriodDate(trueMax)}`);
    expect(PERIOD_LABEL).toMatch(/^\d{2}\.\d{2}\.\d{4} - \d{2}\.\d{2}\.\d{4}$/);
  });

  it("contains no session outside the declared bounds", () => {
    for (const s of sessionData) {
      expect(s.date >= DATA_START_ISO).toBe(true);
      expect(s.date <= DATA_END_ISO).toBe(true);
    }
  });

  it("ElonroadHeader renders the derived PERIOD_LABEL (not a hardcoded string)", async () => {
    const src = await import("@/components/ElonroadHeader?raw").then((m) => m.default);
    // Header must reference PERIOD_LABEL and must NOT contain a hardcoded
    // "DD.MM.YYYY - DD.MM.YYYY" pattern that could go stale.
    expect(src).toContain("PERIOD_LABEL");
    const hardcoded = src.match(/\d{2}\.\d{2}\.\d{4}\s*-\s*\d{2}\.\d{2}\.\d{4}/g);
    expect(hardcoded, `Found hardcoded period strings in ElonroadHeader: ${hardcoded?.join(", ")}`).toBeNull();
  });

  it("DateRangeControl uses derived bounds (no hardcoded Date constructors for bounds)", async () => {
    const src = await import("@/components/DateRangeControl?raw").then((m) => m.default);
    expect(src).toContain("DATA_START_DATE");
    expect(src).toContain("DATA_END_DATE");
    // Guard against re-introducing literals like `new Date(2026, 3, 21)`.
    expect(src).not.toMatch(/new Date\(\s*\d{4}\s*,\s*\d{1,2}\s*,\s*\d{1,2}\s*\)/);
  });
});
