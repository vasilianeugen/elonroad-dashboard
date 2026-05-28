import { sessionData } from "@/data/vehicleData";

const tt106 = sessionData.filter(s => s.vehicleId === "tt-106").sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
console.log("TT-106 sessions:", tt106.length);
for (const s of tt106) {
  console.log(`  ${s.date} ${s.startTime}-${s.endTime} | +${s.chargeAdded}% | ${s.duration.toFixed(1)}min | speed: ${s.chargingSpeed}`);
}
const totalDur = tt106.reduce((sum, s) => sum + s.duration, 0);
console.log("Total duration:", totalDur.toFixed(1), "min =", (totalDur/60).toFixed(1), "hours");
console.log("Avg duration:", (totalDur/tt106.length).toFixed(1), "min");
