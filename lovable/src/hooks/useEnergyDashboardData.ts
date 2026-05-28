import { useQuery } from "@tanstack/react-query";
import { fetchEnergyDashboardData } from "@/lib/energyApi";

const refreshSeconds = Number(import.meta.env.VITE_DASHBOARD_REFRESH_SECONDS ?? 60);
const refreshIntervalMs =
  Number.isFinite(refreshSeconds) && refreshSeconds > 0 ? refreshSeconds * 1000 : false;

export const useEnergyDashboardData = () =>
  useQuery({
    queryKey: ["energy-dashboard"],
    queryFn: fetchEnergyDashboardData,
    refetchInterval: refreshIntervalMs,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });
