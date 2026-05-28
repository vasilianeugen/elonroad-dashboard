import { generateSessionData, sessionData, vehicleData, chargerData } from "@/data/vehicleData";

// Recompute vehicle stats from sessionData
const vAgg: Record<string, { totalCharge: number; totalSessions: number; totalDuration: number; totalSpeed: number }> = {};
for (const s of sessionData) {
  if (!vAgg[s.vehicleId]) vAgg[s.vehicleId] = { totalCharge: 0, totalSessions: 0, totalDuration: 0, totalSpeed: 0 };
  vAgg[s.vehicleId].totalCharge += s.chargeAdded;
  vAgg[s.vehicleId].totalSessions++;
  vAgg[s.vehicleId].totalDuration += s.duration;
  vAgg[s.vehicleId].totalSpeed += s.chargingSpeed;
}

console.log("=== VEHICLE DATA COMPARISON ===");
for (const v of vehicleData) {
  const computed = vAgg[v.id];
  if (computed) {
    const avgTime = computed.totalDuration / computed.totalSessions;
    const avgSpeed = computed.totalSpeed / computed.totalSessions;
    console.log(`${v.name}:`);
    console.log(`  totalCharge: ${v.totalCharge} vs computed: ${computed.totalCharge} ${v.totalCharge === computed.totalCharge ? 'OK' : 'MISMATCH!'}`);
    console.log(`  totalSessions: ${v.totalSessions} vs computed: ${computed.totalSessions} ${v.totalSessions === computed.totalSessions ? 'OK' : 'MISMATCH!'}`);
    console.log(`  avgSessionTime: ${v.avgSessionTime} vs computed: ${avgTime.toFixed(1)} ${Math.abs(v.avgSessionTime - avgTime) < 0.5 ? 'OK' : 'MISMATCH!'}`);
    console.log(`  avgChargingSpeed: ${v.avgChargingSpeed} vs computed: ${avgSpeed.toFixed(2)} ${Math.abs(v.avgChargingSpeed - avgSpeed) < 0.05 ? 'OK' : 'MISMATCH!'}`);
  } else {
    console.log(`${v.name}: NO COMPUTED DATA!`);
  }
}

const cAgg: Record<string, { totalSessions: number; totalDuration: number; totalSpeed: number }> = {};
for (const s of sessionData) {
  if (!cAgg[s.chargerId]) cAgg[s.chargerId] = { totalSessions: 0, totalDuration: 0, totalSpeed: 0 };
  cAgg[s.chargerId].totalSessions++;
  cAgg[s.chargerId].totalDuration += s.duration;
  cAgg[s.chargerId].totalSpeed += s.chargingSpeed;
}

console.log("\n=== CHARGER DATA COMPARISON ===");
for (const c of chargerData) {
  const computed = cAgg[c.id];
  if (computed) {
    const avgLen = computed.totalDuration / computed.totalSessions;
    const avgSpeed = computed.totalSpeed / computed.totalSessions;
    console.log(`${c.name}:`);
    console.log(`  totalSessions: ${c.totalSessions} vs computed: ${computed.totalSessions} ${c.totalSessions === computed.totalSessions ? 'OK' : 'MISMATCH!'}`);
    console.log(`  avgSessionLength: ${c.avgSessionLength} vs computed: ${avgLen.toFixed(1)} ${Math.abs(c.avgSessionLength - avgLen) < 0.5 ? 'OK' : 'MISMATCH!'}`);
    console.log(`  avgChargingSpeed: ${c.avgChargingSpeed} vs computed: ${avgSpeed.toFixed(2)} ${Math.abs(c.avgChargingSpeed - avgSpeed) < 0.05 ? 'OK' : 'MISMATCH!'}`);
  } else {
    console.log(`${c.name}: NO COMPUTED DATA!`);
  }
}

// Check zero count
const all = generateSessionData();
const zero = all.filter(s => s.chargeAdded === 0);
console.log("\n=== ZERO CHARGE SESSIONS ===");
console.log("Total raw:", all.length);
console.log("Zero charge:", zero.length);
console.log("Valid (sessionData):", sessionData.length);
