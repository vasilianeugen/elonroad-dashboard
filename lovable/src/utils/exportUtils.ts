import { 
  ChargingSession, 
  VehicleStats, 
  ChargerStats
} from "@/types/dashboard";
import { sortSessions } from "@/utils/sortSessions";

export const exportSessionsToCSV = (
  sessions: ChargingSession[],
  vehicleFilter: string[],
  chargerFilter: string[],
  dateRange: string,
  vehicles: VehicleStats[] = [],
  chargers: ChargerStats[] = []
) => {
  // Filter sessions by selected vehicles and chargers
  let filteredSessions = vehicleFilter.length > 0
    ? sessions.filter(s => vehicleFilter.includes(s.vehicleId))
    : sessions;
  filteredSessions = chargerFilter.length > 0
    ? filteredSessions.filter(s => chargerFilter.includes(s.chargerId))
    : filteredSessions;

  // Create vehicle name lookup
  const vehicleNames = vehicles.reduce((acc, v) => {
    acc[v.id] = v.name;
    return acc;
  }, {} as Record<string, string>);

  const chargerNames = chargers.reduce((acc, c) => {
    acc[c.id] = c.name;
    return acc;
  }, {} as Record<string, string>);

  // Apply chronological sort (latest date first, latest start time first within same day)
  filteredSessions = sortSessions(filteredSessions, {
    sortField: "date",
    sortDirection: "desc",
    getVehicleName: (id) => vehicleNames[id] || id,
    getChargerName: (id) => chargerNames[id] || id,
  });

  // CSV headers - includes energy calculated from chargeAdded
  const headers = ["Date", "Vehicle", "Charger", "Start Time", "End Time", "Start SoC (%)", "End SoC (%)", "Charge Added (%SoC)", "kWh Charged", "Duration (min)"];
  
  const rows = filteredSessions.map((session) => {
    return [
      session.date,
      vehicleNames[session.vehicleId] || session.vehicleId,
      chargerNames[session.chargerId] || session.chargerId,
      session.startTime,
      session.endTime,
      session.startSoC.toString(),
      session.endSoC.toString(),
      session.chargeAdded.toFixed(2),
      (session.chargeAdded * 2.36).toFixed(1),
      session.duration.toFixed(1)
    ];
  });

  // Calculate summary stats
  const totalKwh = filteredSessions.reduce((sum, s) => sum + s.chargeAdded * 2.36, 0);
  const avgKwh = filteredSessions.length > 0 ? totalKwh / filteredSessions.length : 0;

  // Combine headers, rows, and summary
  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.join(",")),
    "", // blank line
    "SUMMARY",
    `Total Sessions,${filteredSessions.length}`,
    `Total kWh Charged,${totalKwh.toFixed(1)}`,
    `Avg kWh per Session,${avgKwh.toFixed(1)}`
  ].join("\n");

  // Create and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `its-sessions-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportVehicleSummaryToCSV = (
  vehicles: VehicleStats[],
  dateRange: string
) => {
  // CSV headers
  const headers = ["Vehicle", "Total Charge (kWh)", "Avg Session Time (min)", "Total Sessions"];
  
  // CSV rows
  const rows = vehicles.map(v => [
    v.name,
    v.totalCharge.toFixed(1),
    v.avgSessionTime.toFixed(1),
    v.totalSessions.toString()
  ]);

  // Add totals row
  const totals = [
    "TOTAL",
    vehicles.reduce((sum, v) => sum + v.totalCharge, 0).toFixed(1),
    (vehicles.reduce((sum, v) => sum + v.avgSessionTime, 0) / vehicles.length || 0).toFixed(1),
    vehicles.reduce((sum, v) => sum + v.totalSessions, 0).toString()
  ];

  // Combine headers, rows, and totals
  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.join(",")),
    totals.join(",")
  ].join("\n");

  // Create and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `its-vehicle-summary-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportEnergyReportToCSV = (
  sessions: ChargingSession[],
  vehicles: VehicleStats[],
  chargers: ChargerStats[]
) => {
  // Create comprehensive energy report
  const lines: string[] = [];
  
  // Section 1: Overall Energy Statistics
  lines.push("=== ENERGY STATISTICS REPORT ===");
  lines.push("");
  lines.push("Overall Energy Summary");
  lines.push("Metric,Value,Unit");
  lines.push(`Total Sessions,${sessions.length},sessions`);
  lines.push(`Total kWh Charged,${sessions.reduce((sum, s) => sum + s.chargeAdded * 2.36, 0).toFixed(1)},kWh`);
  lines.push("");
  
  // Section 2: Sessions by Charger
  lines.push("Sessions by Charger");
  lines.push("Charger,Sessions");
  chargers.forEach((charger) => {
    lines.push(`${charger.name},${charger.totalSessions}`);
  });
  lines.push("");
  
  // Section 3: Sessions by Vehicle
  lines.push("Sessions by Vehicle");
  lines.push("Vehicle,Sessions");
  
  vehicles.forEach((vehicle) => {
    lines.push(`${vehicle.name},${vehicle.totalSessions}`);
  });
  lines.push("");
  
  // Section 4: Session Details
  lines.push("Session Details");
  lines.push("Session ID,Vehicle,Charger,Date,Start Time,End Time,Start SoC (%),End SoC (%),Charge Added (%SoC),kWh Charged,Duration (min)");
  sessions.forEach(s => {
    const vehicleName = vehicles.find(v => v.id === s.vehicleId)?.name || s.vehicleId;
    const chargerName = chargers.find(c => c.id === s.chargerId)?.name || s.chargerId;
    lines.push(`${s.id},${vehicleName},${chargerName},${s.date},${s.startTime},${s.endTime},${s.startSoC},${s.endSoC},${s.chargeAdded.toFixed(2)},${(s.chargeAdded * 2.36).toFixed(1)},${s.duration.toFixed(1)}`);
  });
  lines.push("");
  
  // Section 5: Charger Performance
  lines.push("Charger Performance");
  lines.push("Charger,Total Sessions,Avg Session Length (min)");
  chargers.forEach(c => {
    lines.push(`${c.name},${c.totalSessions},${c.avgSessionLength.toFixed(1)}`);
  });

  const csvContent = lines.join("\n");

  // Create and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `its-energy-report-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportKwhBreakdownToCSV = (
  sessions: ChargingSession[],
  vehicleFilter: string[],
  chargerFilter: string[],
  dateRange: string,
  vehicles: VehicleStats[] = [],
  chargers: ChargerStats[] = []
) => {
  const filtered = sessions.filter(
    (s) =>
      (vehicleFilter.length === 0 || vehicleFilter.includes(s.vehicleId)) &&
      (chargerFilter.length === 0 || chargerFilter.includes(s.chargerId))
  );

  const activeVehicles = vehicles.filter(
    (v) => vehicleFilter.length === 0 || vehicleFilter.includes(v.id)
  );
  const activeChargers = chargers.filter(
    (c) => chargerFilter.length === 0 || chargerFilter.includes(c.id)
  );

  const totalKwh = filtered.reduce((sum, s) => sum + s.chargeAdded * 2.36, 0);

  const lines: string[] = [];
  lines.push("=== kWh CHARGED BREAKDOWN ===");
  lines.push(`Date Range,${dateRange}`);
  lines.push(`Total Sessions,${filtered.length}`);
  lines.push(`Total kWh Charged,${totalKwh.toFixed(1)}`);
  lines.push("");

  // Per Vehicle
  lines.push("kWh Charged per Vehicle");
  lines.push("Vehicle,Sessions,Total kWh Charged,Share (%)");
  const vehicleRows = activeVehicles
    .map((v) => {
      const vSessions = filtered.filter((s) => s.vehicleId === v.id);
      const kwh = vSessions.reduce((sum, s) => sum + s.chargeAdded * 2.36, 0);
      return { name: v.name, sessions: vSessions.length, kwh };
    })
    .sort((a, b) => b.kwh - a.kwh);
  vehicleRows.forEach((r) => {
    const share = totalKwh > 0 ? (r.kwh / totalKwh) * 100 : 0;
    lines.push(`${r.name},${r.sessions},${r.kwh.toFixed(1)},${share.toFixed(1)}`);
  });
  lines.push(`TOTAL,${filtered.length},${totalKwh.toFixed(1)},100.0`);
  lines.push("");

  // Per Charger
  lines.push("kWh Charged per Charger");
  lines.push("Charger,Sessions,Total kWh Charged,Share (%)");
  const chargerRows = activeChargers
    .map((c) => {
      const cSessions = filtered.filter((s) => s.chargerId === c.id);
      const kwh = cSessions.reduce((sum, s) => sum + s.chargeAdded * 2.36, 0);
      return { name: c.name, sessions: cSessions.length, kwh };
    })
    .sort((a, b) => b.kwh - a.kwh);
  chargerRows.forEach((r) => {
    const share = totalKwh > 0 ? (r.kwh / totalKwh) * 100 : 0;
    lines.push(`${r.name},${r.sessions},${r.kwh.toFixed(1)},${share.toFixed(1)}`);
  });
  lines.push(`TOTAL,${filtered.length},${totalKwh.toFixed(1)},100.0`);

  const csvContent = lines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `its-kwh-breakdown-${dateRange}-${new Date().toISOString().split("T")[0]}.csv`
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
