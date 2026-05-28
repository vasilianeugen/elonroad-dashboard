import { describe, it, expect } from "vitest";
import { sortSessions, type SessionSortField, type SessionSortDirection } from "./sortSessions";
import type { ChargingSession } from "@/types/dashboard";

const mk = (over: Partial<ChargingSession> & Pick<ChargingSession, "id" | "date" | "startTime">): ChargingSession => ({
  vehicleId: "tt-109",
  chargerId: "charger-5",
  endTime: "00:00:00",
  startSoC: 50,
  endSoC: 60,
  chargeAdded: 10,
  chargingSpeed: 1,
  duration: 10,
  ...over,
});

const fixtures: ChargingSession[] = [
  // Same day TT-109 / Charger-5 — provided out of chronological order on purpose
  mk({ id: "b", date: "2026-05-13", startTime: "17:36:21", endTime: "17:40:55", duration: 5, chargeAdded: 4 }),
  mk({ id: "a", date: "2026-05-13", startTime: "17:29:52", endTime: "17:33:43", duration: 4, chargeAdded: 3 }),
  // Different day, different vehicle
  mk({ id: "c", date: "2026-05-12", startTime: "08:00:00", vehicleId: "tt-107", chargerId: "charger-1", duration: 20, chargeAdded: 15 }),
  mk({ id: "d", date: "2026-05-14", startTime: "06:15:00", vehicleId: "tt-110", chargerId: "charger-3", duration: 30, chargeAdded: 25 }),
  // Same day as A/B but earlier start
  mk({ id: "e", date: "2026-05-13", startTime: "06:00:00", vehicleId: "tt-107", chargerId: "charger-1", duration: 12, chargeAdded: 8 }),
];

const opts = (sortField: SessionSortField, sortDirection: SessionSortDirection) => ({
  sortField,
  sortDirection,
  getVehicleName: (id: string) => id.toUpperCase(),
  getChargerName: (id: string) => id.toUpperCase(),
});

const fields: SessionSortField[] = ["date", "vehicle", "charger", "duration", "chargeAdded", "energyKwh", "kwhCharged"];
const directions: SessionSortDirection[] = ["asc", "desc"];

describe("sortSessions latest-first chronological tiebreaker", () => {
  it("places the 17:36 session before the 17:29 session for the regression case", () => {
    const sorted = sortSessions(fixtures, opts("date", "desc"));
    const sameDay = sorted.filter((s) => s.date === "2026-05-13");
    const startTimes = sameDay.map((s) => s.startTime);
    expect(startTimes).toEqual([...startTimes].sort().reverse());
    // b (17:36) must come before a (17:29)
    expect(sameDay.findIndex((s) => s.id === "b")).toBeLessThan(sameDay.findIndex((s) => s.id === "a"));
  });

  for (const direction of directions) {
    it(`keeps same-day rows latest-first when sorting by date ${direction}`, () => {
      const sorted = sortSessions(fixtures, opts("date", direction));
      const byDate = new Map<string, string[]>();
      for (const s of sorted) {
        const arr = byDate.get(s.date) ?? [];
        arr.push(s.startTime);
        byDate.set(s.date, arr);
      }
      for (const [, times] of byDate) {
        expect(times).toEqual([...times].sort().reverse());
      }
    });
  }

  // For non-date sorts, the chronological tiebreaker only kicks in when the
  // primary key ties. Build a fixture where two rows tie on every numeric/name
  // field so we can assert the fallback ordering deterministically.
  const tied: ChargingSession[] = [
    mk({ id: "late", date: "2026-05-13", startTime: "17:36:21", endTime: "17:40:55", duration: 7, chargeAdded: 5 }),
    mk({ id: "early", date: "2026-05-13", startTime: "17:29:52", endTime: "17:33:43", duration: 7, chargeAdded: 5 }),
  ];

  for (const field of fields.filter((f) => f !== "date")) {
    for (const direction of directions) {
      it(`falls back to start time desc when ${field} ${direction} ties`, () => {
        const sorted = sortSessions(tied, opts(field, direction));
        expect(sorted.map((s) => s.id)).toEqual(["late", "early"]);
      });
    }
  }

  it("respects the primary sort direction for the chosen field", () => {
    const asc = sortSessions(fixtures, opts("duration", "asc")).map((s) => s.duration);
    const desc = sortSessions(fixtures, opts("duration", "desc")).map((s) => s.duration);
    expect(asc).toEqual([...asc].sort((x, y) => x - y));
    expect(desc).toEqual([...desc].sort((x, y) => y - x));
  });

  it("does not mutate the input array", () => {
    const input = [...fixtures];
    const snapshot = input.map((s) => s.id);
    sortSessions(input, opts("date", "desc"));
    expect(input.map((s) => s.id)).toEqual(snapshot);
  });
});
