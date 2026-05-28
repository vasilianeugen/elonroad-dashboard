import { sessionData } from "@/data/vehicleData";

const suspicious = sessionData.filter(s => s.duration > 1000).sort((a, b) => b.duration - a.duration);
console.log("Sessions with duration > 1000 min:", suspicious.length);
for (const s of suspicious) {
  console.log(`  ${s.vehicleId} ${s.chargerId} ${s.date} ${s.startTime}-${s.endTime} | +${s.chargeAdded}% | ${s.duration.toFixed(1)}min | speed: ${s.chargingSpeed}`);
}

const crossMidnight = sessionData.filter(s => s.endTime < s.startTime);
console.log("\nSessions where endTime < startTime (cross-midnight on same date):", crossMidnight.length);
for (const s of crossMidnight.slice(0, 20)) {
  console.log(`  ${s.vehicleId} ${s.chargerId} ${s.date} ${s.startTime}-${s.endTime} | +${s.chargeAdded}% | ${s.duration.toFixed(1)}min`);
}
