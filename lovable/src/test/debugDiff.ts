// Test diffMinutes for the suspicious session
function diffMinutes(date: string, start: string, end: string): number {
  const s = new Date(`${date}T${start}`);
  let e = new Date(`${date}T${end}`);
  console.log("s:", s.toISOString());
  console.log("e (before fix):", e.toISOString());
  console.log("e < s?", e.getTime() < s.getTime());
  if (e.getTime() < s.getTime()) {
    e = new Date(e.getTime() + 24 * 60 * 60 * 1000);
    console.log("e (after +24h):", e.toISOString());
  }
  const dur = (e.getTime() - s.getTime()) / 60000;
  console.log("duration:", dur, "min");
  return dur;
}

console.log("=== TT-106 session ===");
diffMinutes("2026-05-08", "20:45:31", "15:09:29");

console.log("\n=== tt-109 charger-1 session ===");
diffMinutes("2026-03-28", "00:22:40", "15:30:45");

console.log("\n=== tt-107 charger-4 session ===");
diffMinutes("2026-03-31", "16:10:15", "15:41:25");
