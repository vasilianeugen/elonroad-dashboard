import { validateChargingLogs } from "../src/utils/validateChargingLog";

const rows = [
  { vehicle: "TT-107", charger: "Charger-5 Converter",  date: "17/04/2026", startTime: "13:50:18", endTime: "13:52:15", startSoC: 94, endSoC: 95 },
  { vehicle: "TT-107", charger: "Charger-4 Power Rail", date: "17/04/2026", startTime: "16:48:57", endTime: "16:56:54", startSoC: 95, endSoC: 95 },
  { vehicle: "TT-107", charger: "Charger-5 Converter",  date: "17/04/2026", startTime: "20:05:07", endTime: "21:32:00", startSoC: 95, endSoC: 95 },
  { vehicle: "TT-107", charger: "Charger-5 Converter",  date: "20/04/2026", startTime: "16:49:08", endTime: "16:51:51", startSoC: 65, endSoC: 66 },
  { vehicle: "TT-107", charger: "Charger-5 Converter",  date: "20/04/2026", startTime: "16:52:20", endTime: "17:00:56", startSoC: 66, endSoC: 73 },
  { vehicle: "TT-108", charger: "Charger-4 Power Rail", date: "20/04/2026", startTime: "18:50:36", endTime: "19:01:32", startSoC: 76, endSoC: 84 },
  { vehicle: "TT-107", charger: "Charger-1 Converter",  date: "20/04/2026", startTime: "19:54:39", endTime: "20:33:23", startSoC: 73, endSoC: 73 },
  { vehicle: "TT-107", charger: "Charger-1 Converter",  date: "21/04/2026", startTime: "13:41:02", endTime: "14:14:20", startSoC: 67, endSoC: 89 },
  { vehicle: "TT-108", charger: "Charger-2 Converter",  date: "21/04/2026", startTime: "13:45:16", endTime: "14:15:07", startSoC: 74, endSoC: 94 },
  { vehicle: "TT-106", charger: "Charger-3 Converter",  date: "21/04/2026", startTime: "13:46:01", endTime: "13:47:13", startSoC: 94, endSoC: 95 },
  { vehicle: "TT-106", charger: "Charger-3 Converter",  date: "21/04/2026", startTime: "14:36:24", endTime: "14:39:31", startSoC: 95, endSoC: 95 },
  { vehicle: "TT-107", charger: "Charger-4 Power Rail", date: "21/04/2026", startTime: "16:10:54", endTime: "16:30:27", startSoC: 89, endSoC: 89 },
  { vehicle: "TT-108", charger: "Charger-2 Converter",  date: "21/04/2026", startTime: "18:45:37", endTime: "19:47:12", startSoC: 94, endSoC: 94 },
  { vehicle: "TT-106", charger: "Charger-5 Converter",  date: "21/04/2026", startTime: "19:05:57", endTime: "19:33:59", startSoC: 95, endSoC: 95 },
  { vehicle: "TT-106", charger: "Charger-5 Converter",  date: "21/04/2026", startTime: "19:34:51", endTime: "19:37:05", startSoC: 95, endSoC: 95 },
  { vehicle: "TT-107", charger: "Charger-3 Converter",  date: "21/04/2026", startTime: "19:58:50", endTime: "21:13:49", startSoC: 89, endSoC: 95 },
  { vehicle: "TT-106", charger: "Charger-5 Converter",  date: "2026-04-21 / 2026-04-22", startTime: "23:40:07", endTime: "00:03:10", startSoC: 76, endSoC: 95 },
  { vehicle: "TT-107", charger: "Charger-3 Converter",  date: "2026-04-21 / 2026-04-22", startTime: "23:48:45", endTime: "00:03:57", startSoC: 85, endSoC: 94 },
];

const res = validateChargingLogs(rows);
console.log("rows in:        ", rows.length);
console.log("invalid:        ", res.invalid.length);
console.log("valid total:    ", res.valid.length);
console.log("toInsert (>0%): ", res.toInsert.length);
console.log("zeroFiltered:   ", res.zeroFiltered.length);
if (res.invalid.length) {
  console.log("\n--- INVALID ---");
  for (const i of res.invalid) console.log(`  row ${i.index} [${i.field}]: ${i.message}`);
  process.exit(1);
}
console.log("\n--- toInsert summary ---");
for (const v of res.toInsert) {
  console.log(`  ${v.vehicleId} ${v.chargerId} ${v.date} ${v.startTime}-${v.endTime} +${v.chargeAdded}% ${v.duration}min${v.crossesMidnight ? " (cross-midnight)" : ""}`);
}
