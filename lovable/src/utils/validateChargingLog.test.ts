import { describe, it, expect } from "vitest";
import { validateChargingLogs } from "./validateChargingLog";

describe("validateChargingLogs", () => {
  it("accepts a well-formed row and computes derived fields", () => {
    const res = validateChargingLogs([
      {
        vehicle: "TT-107",
        charger: "Charger-5 Converter",
        date: "21/04/2026",
        startTime: "13:41:02",
        endTime: "14:14:20",
        startSoC: 67,
        endSoC: 89,
      },
    ]);
    expect(res.invalid).toEqual([]);
    expect(res.toInsert).toHaveLength(1);
    const v = res.toInsert[0];
    expect(v.vehicleId).toBe("tt-107");
    expect(v.chargerId).toBe("charger-5");
    expect(v.date).toBe("2026-04-21");
    expect(v.chargeAdded).toBe(22);
    expect(v.duration).toBeGreaterThan(33);
  });

  it("filters zero-charge rows into zeroFiltered, not toInsert", () => {
    const res = validateChargingLogs([
      {
        vehicle: "TT-107",
        charger: "Charger-4 Power Rail",
        date: "17/04/2026",
        startTime: "16:48:57",
        endTime: "16:56:54",
        startSoC: 95,
        endSoC: 95,
      },
    ]);
    expect(res.invalid).toEqual([]);
    expect(res.toInsert).toHaveLength(0);
    expect(res.zeroFiltered).toHaveLength(1);
  });

  it("handles cross-midnight date ranges", () => {
    const res = validateChargingLogs([
      {
        vehicle: "TT-106",
        charger: "Charger-5 Converter",
        date: "2026-04-21 / 2026-04-22",
        startTime: "23:40:07",
        endTime: "00:03:10",
        startSoC: 76,
        endSoC: 95,
      },
    ]);
    expect(res.invalid).toEqual([]);
    expect(res.toInsert[0].date).toBe("2026-04-21");
    expect(res.toInsert[0].crossesMidnight).toBe(true);
    expect(res.toInsert[0].duration).toBeGreaterThan(20);
  });

  it("rejects missing fields, bad SoC, and endSoC < startSoC", () => {
    const res = validateChargingLogs([
      { vehicle: "", charger: "Charger-1", date: "21/04/2026", startTime: "13:00:00", endTime: "13:10:00", startSoC: 50, endSoC: 60 },
      { vehicle: "TT-107", charger: "Charger-1", date: "21/04/2026", startTime: "13:00:00", endTime: "13:10:00", startSoC: 80, endSoC: 70 },
      { vehicle: "TT-107", charger: "Charger-1", date: "bad-date", startTime: "13:00:00", endTime: "13:10:00", startSoC: 50, endSoC: 60 },
      { vehicle: "TT-107", charger: "no-charger-here", date: "21/04/2026", startTime: "13:00:00", endTime: "13:10:00", startSoC: 50, endSoC: 60 },
    ]);
    expect(res.toInsert).toHaveLength(0);
    expect(res.invalid.length).toBeGreaterThanOrEqual(4);
    expect(res.invalid.map((i) => i.index)).toEqual(expect.arrayContaining([0, 1, 2, 3]));
  });
});
