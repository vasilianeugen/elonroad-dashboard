import { useMemo } from "react";
import { Battery, Clock, Lightbulb, TrendingUp, Zap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ChargerStats, ChargingSession, VehicleStats } from "@/types/dashboard";
import { KWH_PER_PERCENT, formatPeriodDate } from "@/lib/dashboardData";

interface Insight {
  icon: typeof Lightbulb;
  title: string;
  description: string;
  highlight: string;
}

interface InsightsPanelProps {
  sessions?: ChargingSession[];
  vehicles?: VehicleStats[];
  chargers?: ChargerStats[];
  startIso?: string;
  endIso?: string;
}

function fmt(n: number, lang: "en" | "sv", digits = 0): string {
  return n.toLocaleString(lang === "en" ? "en-US" : "sv-SE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function getTopVehicleFromSessions(sessions: ChargingSession[], vehicles: VehicleStats[]) {
  const byVehicle = new Map<string, { id: string; name: string; totalCharge: number }>();

  sessions.forEach((session) => {
    const vehicle = vehicles.find((v) => v.id === session.vehicleId);
    const current = byVehicle.get(session.vehicleId) ?? {
      id: session.vehicleId,
      name: vehicle?.name ?? session.vehicleId,
      totalCharge: 0,
    };
    current.totalCharge += session.chargeAdded * KWH_PER_PERCENT;
    byVehicle.set(session.vehicleId, current);
  });

  return [...byVehicle.values()].sort((a, b) => b.totalCharge - a.totalCharge)[0];
}

function getTopChargerFromSessions(sessions: ChargingSession[], chargers: ChargerStats[]) {
  const byCharger = new Map<string, { id: string; name: string; totalCharge: number; totalSessions: number }>();

  sessions.forEach((session) => {
    const charger = chargers.find((c) => c.id === session.chargerId);
    const current = byCharger.get(session.chargerId) ?? {
      id: session.chargerId,
      name: charger?.name ?? session.chargerId,
      totalCharge: 0,
      totalSessions: 0,
    };
    current.totalCharge += session.chargeAdded * KWH_PER_PERCENT;
    current.totalSessions += 1;
    byCharger.set(session.chargerId, current);
  });

  return [...byCharger.values()].sort(
    (a, b) => b.totalCharge - a.totalCharge || b.totalSessions - a.totalSessions
  )[0];
}

export const InsightsPanel = ({
  sessions = [],
  vehicles = [],
  chargers = [],
  startIso,
  endIso,
}: InsightsPanelProps) => {
  const { language } = useLanguage();

  const insights = useMemo<Insight[]>(() => {
    const lang = language as "en" | "sv";
    const totalSessions = sessions.length;
    const totalChargePct = sessions.reduce((sum, s) => sum + s.chargeAdded, 0);
    const totalKWh = totalChargePct * KWH_PER_PERCENT;
    const avgKWh = totalSessions > 0 ? totalKWh / totalSessions : 0;
    const topVehicle = getTopVehicleFromSessions(sessions, vehicles);
    const mostUsedCharger = getTopChargerFromSessions(sessions, chargers);
    const avgDuration =
      totalSessions > 0
        ? sessions.reduce((sum, s) => sum + s.duration, 0) / totalSessions
        : 0;
    const period =
      startIso && endIso
        ? `${formatPeriodDate(startIso)} - ${formatPeriodDate(endIso)}`
        : lang === "en"
          ? "No live period yet"
          : "Ingen liveperiod ännu";

    if (lang === "en") {
      return [
        {
          icon: TrendingUp,
          title: topVehicle ? `${topVehicle.name} has highest live total` : "No vehicle totals yet",
          description: topVehicle
            ? `${topVehicle.name} is currently the top vehicle in the selected sessions.`
            : "The API returned no vehicle sessions yet.",
          highlight: topVehicle ? `${fmt(topVehicle.totalCharge, "en", 1)} kWh total` : "0 kWh",
        },
        {
          icon: Zap,
          title: mostUsedCharger ? `${mostUsedCharger.name} has highest charger energy` : "No charger rows yet",
          description: mostUsedCharger
            ? `${mostUsedCharger.name} has the highest energy in the selected sessions.`
            : "The API returned no charger sessions yet.",
          highlight: mostUsedCharger ? `${fmt(mostUsedCharger.totalCharge, "en", 3)} kWh` : "0 kWh",
        },
        {
          icon: Clock,
          title: `${totalSessions} live sessions in period`,
          description: `The dashboard is using database/API data only for ${period}.`,
          highlight: `${fmt(avgDuration, "en", 1)} min avg duration`,
        },
        {
          icon: Battery,
          title: `Total ${fmt(totalKWh, "en", 1)} kWh energy`,
          description: `Selected sessions currently add up to ${fmt(totalKWh, "en", 1)} kWh.`,
          highlight: `${fmt(avgKWh, "en", 2)} kWh avg/session`,
        },
      ];
    }

    return [
      {
        icon: TrendingUp,
        title: topVehicle ? `${topVehicle.name} har högst live-total` : "Inga fordonstotaler ännu",
        description: topVehicle
          ? `${topVehicle.name} är för närvarande toppfordonet i valda sessioner.`
          : "API:t returnerade inga fordonssessioner ännu.",
        highlight: topVehicle ? `${fmt(topVehicle.totalCharge, "sv", 1)} kWh totalt` : "0 kWh",
      },
      {
        icon: Zap,
        title: mostUsedCharger ? `${mostUsedCharger.name} har högst laddarenergi` : "Inga laddarrader ännu",
        description: mostUsedCharger
          ? `${mostUsedCharger.name} har högst energi i valda sessioner.`
          : "API:t returnerade inga laddarsessioner ännu.",
        highlight: mostUsedCharger ? `${fmt(mostUsedCharger.totalCharge, "sv", 3)} kWh` : "0 kWh",
      },
      {
        icon: Clock,
        title: `${totalSessions} live-sessioner i perioden`,
        description: `Dashboarden använder endast databas/API-data för ${period}.`,
        highlight: `${fmt(avgDuration, "sv", 1)} min snittlängd`,
      },
      {
        icon: Battery,
        title: `Totalt ${fmt(totalKWh, "sv", 1)} kWh energi`,
        description: `Valda sessioner summerar just nu till ${fmt(totalKWh, "sv", 1)} kWh.`,
        highlight: `${fmt(avgKWh, "sv", 2)} kWh snitt/session`,
      },
    ];
  }, [chargers, endIso, language, sessions, startIso, vehicles]);

  return (
    <div className="elonroad-card p-6 animate-slide-up">
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Lightbulb className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">
            {language === "en" ? "Key Insights" : "Viktiga Insikter"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {language === "en" ? "Insights from database-backed data" : "Insikter från databasbaserad data"}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {insights.map((insight, index) => (
          <div
            key={index}
            className="p-4 rounded-lg bg-secondary/30 border border-border hover:border-primary/30 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded bg-background">
                <insight.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-foreground mb-1">{insight.title}</h4>
                <p className="text-sm text-muted-foreground mb-2">{insight.description}</p>
                <span className="inline-flex items-center px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {insight.highlight}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
