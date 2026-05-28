import { sessionData } from "@/data/vehicleData";

// Focus on May 8-13 new sessions
const newSessions = sessionData.filter(s => s.date >= "2026-05-08" && s.date <= "2026-05-13");
console.log("New sessions (May 8-13):", newSessions.length);

const byVehicle: Record<string, typeof newSessions> = {};
for (const s of newSessions) {
  if (!byVehicle[s.vehicleId]) byVehicle[s.vehicleId] = [];
  byVehicle[s.vehicleId].push(s);
}

for (const [vid, sessions] of Object.entries(byVehicle).sort()) {
  console.log(`\n${vid}: ${sessions.length} sessions`);
  for (const s of sessions.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))) {
    console.log(`  ${s.date} ${s.startTime}-${s.endTime} | +${s.chargeAdded}% | ${s.duration.toFixed(1)}min | ${s.chargerId}`);
  }
}

const suspicious = newSessions.filter(s => s.duration > 100);
console.log("\n=== Suspicious (>100min) in new batch ===");
for (const s of suspicious) {
  console.log(`  ${s.vehicleId} ${s.date} ${s.startTime}-${s.endTime} | +${s.chargeAdded}% | ${s.duration.toFixed(1)}min`);
}
