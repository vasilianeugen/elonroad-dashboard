import { generateSessionData, sessionData } from "@/data/vehicleData";

const all = generateSessionData();
const zero = all.filter(s => s.chargeAdded === 0);
const valid = all.filter(s => s.chargeAdded > 0);

console.log("Total sessions (raw):", all.length);
console.log("Zero-charge sessions (excluded):", zero.length);
console.log("Valid sessions (chargeAdded > 0):", valid.length);
console.log("sessionData.length:", sessionData.length);
console.log("");
console.log("Zero sessions by vehicle:");
const byV: Record<string, number> = {};
for (const s of zero) {
  byV[s.vehicleId] = (byV[s.vehicleId] || 0) + 1;
}
for (const [vid, count] of Object.entries(byV).sort()) {
  console.log(`  ${vid}: ${count}`);
}
console.log("");
console.log("All zero sessions:");
for (const s of zero) {
  console.log(`  ${s.id} | ${s.vehicleId} | ${s.chargerId} | ${s.date} | ${s.startTime}-${s.endTime} | SoC: ${s.startSoC}%→${s.endSoC}% | +${s.chargeAdded}% | ${s.duration}min`);
}
console.log("");
console.log("Verification: valid.length === sessionData.length ?", valid.length === sessionData.length);
