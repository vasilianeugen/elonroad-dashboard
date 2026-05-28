import type { ChargingSession } from "@/types/dashboard";

export const KWH_PER_PERCENT = 2.36;

export type SessionStats = {
  totalCharge: number;
  totalSessions: number;
  avgChargingSpeed: number;
  avgTime: number;
};

export function toNumber(value: string | number | undefined | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function splitIsoDateTime(value?: string) {
  if (!value) return { date: new Date().toISOString().slice(0, 10), time: "00:00:00" };
  const date = value.slice(0, 10);
  const time = value.slice(11, 19) || "00:00:00";
  return { date, time };
}

function atNoon(iso: string) {
  return new Date(`${iso}T12:00:00`);
}

export function getDateBounds(sessions: ChargingSession[]) {
  const dates = sessions.map((s) => s.date).filter(Boolean).sort();
  const startIso = dates[0];
  const endIso = dates[dates.length - 1];

  return {
    startIso,
    endIso,
    startDate: startIso ? atNoon(startIso) : undefined,
    endDate: endIso ? atNoon(endIso) : undefined,
  };
}

export function formatPeriodDate(iso?: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function filterSessionsByDateRange(
  sessions: ChargingSession[],
  dateRange: string,
  customStart?: Date,
  customEnd?: Date
) {
  if (dateRange === "custom" && customStart && customEnd) {
    const start = new Date(customStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(customEnd);
    end.setHours(23, 59, 59, 999);
    return sessions.filter((session) => {
      const sessionDate = atNoon(session.date);
      return sessionDate >= start && sessionDate <= end;
    });
  }

  if (dateRange === "all") return sessions;

  const daysBack = dateRange === "7d" ? 7 : dateRange === "14d" ? 14 : 30;
  const { endIso } = getDateBounds(sessions);
  if (!endIso) return [];

  const cutoffDate = atNoon(endIso);
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  return sessions.filter((session) => atNoon(session.date) >= cutoffDate);
}

export function calculateSessionStats(
  sessions: ChargingSession[],
  vehicleFilter: string[] = [],
  chargerFilter: string[] = []
): SessionStats {
  const filteredSessions = sessions.filter(
    (s) =>
      (vehicleFilter.length === 0 || vehicleFilter.includes(s.vehicleId)) &&
      (chargerFilter.length === 0 || chargerFilter.includes(s.chargerId))
  );

  if (filteredSessions.length === 0) {
    return {
      totalCharge: 0,
      totalSessions: 0,
      avgChargingSpeed: 0,
      avgTime: 0,
    };
  }

  const totalCharge = filteredSessions.reduce((sum, s) => sum + s.chargeAdded, 0);
  const totalSessions = filteredSessions.length;
  const avgChargingSpeed =
    filteredSessions.reduce((sum, s) => sum + s.chargingSpeed, 0) / totalSessions;
  const avgTime = filteredSessions.reduce((sum, s) => sum + s.duration, 0) / totalSessions;

  return {
    totalCharge,
    totalSessions,
    avgChargingSpeed,
    avgTime,
  };
}

export function getDailyChargeData(
  sessions: ChargingSession[],
  vehicleFilter: string[] = [],
  dateRange = "all",
  customStart?: Date,
  customEnd?: Date,
  unit: "kWh" | "%SoC" = "%SoC"
) {
  const filteredByDate = filterSessionsByDateRange(sessions, dateRange, customStart, customEnd);
  const dailyData: Record<string, Record<string, number>> = {};

  filteredByDate.forEach((session) => {
    if (vehicleFilter.length > 0 && !vehicleFilter.includes(session.vehicleId)) return;

    dailyData[session.date] ??= {};
    dailyData[session.date][session.vehicleId] ??= 0;
    dailyData[session.date][session.vehicleId] +=
      session.chargeAdded * (unit === "kWh" ? KWH_PER_PERCENT : 1);
  });

  return Object.entries(dailyData)
    .map(([date, vehicles]) => ({
      date,
      ...vehicles,
      total: Object.values(vehicles).reduce((sum, val) => sum + val, 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
