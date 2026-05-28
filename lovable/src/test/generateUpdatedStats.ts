import { sessionData, vehicleData, chargerData } from "@/data/vehicleData";

// Recompute vehicle stats from sessionData
const vAgg: Record<string, { totalCharge: number; totalSessions: number; totalDuration: number; totalSpeed: number }> = {};
for (const s of sessionData) {
  if (!vAgg[s.vehicleId]) vAgg[s.vehicleId] = { totalCharge: 0, totalSessions: 0, totalDuration: 0, totalSpeed: 0 };
  vAgg[s.vehicleId].totalCharge += s.chargeAdded;
  vAgg[s.vehicleId].totalSessions++;
  vAgg[s.vehicleId].totalDuration += s.duration;
  vAgg[s.vehicleId].totalSpeed += s.chargingSpeed;
}

console.log("=== UPDATED VEHICLE DATA ===");
for (const v of vehicleData) {
  const c = vAgg[v.id];
  if (c) {
    const avgTime = c.totalDuration / c.totalSessions;
    const avgSpeed = c.totalSpeed / c.totalSessions;
    console.log(`  {`);
    console.log(`    id: "${v.id}",`);
    console.log(`    name: "${v.name}",`);
    console.log(`    totalCharge: ${Math.round(c.totalCharge)},`);
    console.log(`    avgChargingSpeed: ${parseFloat(avgSpeed.toFixed(2))},`);
    console.log(`    avgSessionTime: ${parseFloat(avgTime.toFixed(1))},`);
    console.log(`    totalSessions: ${c.totalSessions},`);
    console.log(`    color: "${v.color}",`);
    console.log(`  },`);
  }
}

const cAgg: Record<string, { totalSessions: number; totalDuration: number; totalSpeed: number }> = {};
for (const s of sessionData) {
  if (!cAgg[s.chargerId]) cAgg[s.chargerId] = { totalSessions: 0, totalDuration: 0, totalSpeed: 0 };
  cAgg[s.chargerId].totalSessions++;
  cAgg[s.chargerId].totalDuration += s.duration;
  cAgg[s.chargerId].totalSpeed += s.chargingSpeed;
}

console.log("\n=== UPDATED CHARGER DATA ===");
for (const c of chargerData) {
  const comp = cAgg[c.id];
  if (comp) {
    const avgLen = comp.totalDuration / comp.totalSessions;
    const avgSpeed = comp.totalSpeed / comp.totalSessions;
    console.log(`  {`);
    console.log(`    id: "${c.id}",`);
    console.log(`    name: "${c.name}",`);
    console.log(`    avgChargingSpeed: ${parseFloat(avgSpeed.toFixed(2))},`);
    console.log(`    totalSessions: ${comp.totalSessions},`);
    console.log(`    avgSessionLength: ${parseFloat(avgLen.toFixed(1))},`);
    console.log(`    color: "${c.color}",`);
    console.log(`  },`);
  }
}
