const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

export interface DashboardNowResponse {
  instance: string;
  host_name: string;
  prometheus: {
    status: string;
    sampled_at?: string;
    metrics?: Record<string, { value: string; sampled_at?: string }>;
  };
  loki: {
    status: string;
    sampled_at?: string;
    snapshot?: DashboardLokiSnapshot | null;
    latest_snapshot?: DashboardLokiSnapshot | null;
  };
}

export interface DashboardLokiSnapshot {
      vehicle_id?: string;
      vehicle_name?: string;
      vehicle_type?: string;
      topic_device_id?: string;
      host_name?: string;
      session_id?: string;
      energy_link_state?: string;
      meter_total_input_wh?: string;
      meter_voltage_v?: string;
      meter_current_a?: string;
      sampled_at?: string;
}

export interface DailyEnergyAggregate {
  id: number;
  event_date: string;
  total_sessions: number;
  total_energy_kwh: string;
  average_duration_minutes: string;
  active_vehicles: number;
  active_chargers: number;
  source_breakdown?: Record<string, string>;
}

export interface VehicleDailyAggregate {
  id: number;
  event_date: string;
  source: string;
  host_name: string;
  vehicle_id: string;
  vehicle_name?: string;
  vehicle_type?: string;
  total_sessions: number;
  total_energy_kwh: string;
  average_duration_minutes: string;
  average_battery_soc_percent?: string;
  sample_count: number;
}

export interface ChargerDailyAggregate {
  id: number;
  event_date: string;
  source: string;
  host_name: string;
  charger_id: string;
  charger_name?: string;
  total_sessions: number;
  total_energy_kwh: string;
  average_duration_minutes: string;
  sample_count: number;
}

export interface SessionSummary {
  id: number;
  source: string;
  host_name: string;
  session_id: string;
  vehicle_id: string;
  vehicle_name?: string;
  vehicle_type?: string;
  started_at?: string;
  ended_at?: string;
  duration_minutes: string;
  energy_kwh: string;
  meter_start_wh?: string;
  meter_end_wh?: string;
  sample_count: number;
  state_counts?: Record<string, number>;
}

export interface EnergyDashboardData {
  now: DashboardNowResponse;
  daily: DailyEnergyAggregate[];
  vehicles: VehicleDailyAggregate[];
  chargers: ChargerDailyAggregate[];
  sessions: SessionSummary[];
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchEnergyDashboardData(): Promise<EnergyDashboardData> {
  const [now, daily, vehicles, chargers, sessions] = await Promise.all([
    getJson<DashboardNowResponse>("/dashboard/now"),
    getJson<DailyEnergyAggregate[]>("/aggregates/daily"),
    getJson<VehicleDailyAggregate[]>("/aggregates/vehicles/daily"),
    getJson<ChargerDailyAggregate[]>("/aggregates/chargers/daily"),
    getJson<SessionSummary[]>("/sessions/summaries"),
  ]);

  return { now, daily, vehicles, chargers, sessions };
}
