import type { ChargingSession } from "@/types/dashboard";

export type SessionSortField =
  | "date"
  | "startTime"
  | "vehicle"
  | "charger"
  | "duration"
  | "chargeAdded"
  | "energyKwh"
  | "kwhCharged";

export type SessionSortDirection = "asc" | "desc";

const KWH_PER_SOC_PERCENT = 0.27;
const KWH_PER_SOC = 2.36;

const sessionStartMs = (session: ChargingSession): number => {
  const timestamp = session.startedAt
    ? Date.parse(session.startedAt)
    : Date.parse(`${session.date}T${session.startTime || "00:00:00"}Z`);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export interface SortSessionOptions {
  sortField: SessionSortField;
  sortDirection: SessionSortDirection;
  getVehicleName: (id: string) => string;
  getChargerName: (id: string) => string;
}

/**
 * Sort sessions by the chosen field/direction with a stable latest-first
 * tiebreaker (date desc, then startTime desc) so rows sharing the primary key
 * always show the most recent charging session first.
 */
export const sortSessions = (
  sessions: ChargingSession[],
  { sortField, sortDirection, getVehicleName, getChargerName }: SortSessionOptions
): ChargingSession[] => {
  const multiplier = sortDirection === "asc" ? 1 : -1;
  return [...sessions].sort((a, b) => {
    let primary = 0;
    switch (sortField) {
      case "date":
      case "startTime":
        primary = (sessionStartMs(a) - sessionStartMs(b)) * multiplier;
        break;
      case "vehicle":
        primary = getVehicleName(a.vehicleId).localeCompare(getVehicleName(b.vehicleId)) * multiplier;
        break;
      case "charger":
        primary = getChargerName(a.chargerId).localeCompare(getChargerName(b.chargerId)) * multiplier;
        break;
      case "duration":
        primary = (a.duration - b.duration) * multiplier;
        break;
      case "chargeAdded":
        primary = (a.chargeAdded - b.chargeAdded) * multiplier;
        break;
      case "energyKwh":
        primary = (a.chargeAdded * KWH_PER_SOC_PERCENT - b.chargeAdded * KWH_PER_SOC_PERCENT) * multiplier;
        break;
      case "kwhCharged":
        primary = (a.chargeAdded * KWH_PER_SOC - b.chargeAdded * KWH_PER_SOC) * multiplier;
        break;
    }
    if (primary !== 0) return primary;
    return sessionStartMs(b) - sessionStartMs(a);
  });
};
