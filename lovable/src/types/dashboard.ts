export interface VehicleStats {
  id: string;
  name: string;
  totalCharge: number;
  avgChargingSpeed: number;
  avgSessionTime: number;
  totalSessions: number;
  color: string;
}

export interface ChargerStats {
  id: string;
  name: string;
  totalCharge: number;
  avgChargingSpeed: number;
  totalSessions: number;
  avgSessionLength: number;
  color: string;
}

export interface ChargingSession {
  id: string;
  vehicleId: string;
  chargerId: string;
  startedAt?: string;
  endedAt?: string;
  date: string;
  startTime: string;
  endTime: string;
  startSoC: number;
  endSoC: number;
  chargeAdded: number;
  chargingSpeed: number;
  duration: number;
}
