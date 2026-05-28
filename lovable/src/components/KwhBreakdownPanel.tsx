import { useMemo } from "react";
import { Battery, Zap, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChargerStats, ChargingSession, VehicleStats } from "@/types/dashboard";
import { useLanguage } from "@/contexts/LanguageContext";
import { exportKwhBreakdownToCSV } from "@/utils/exportUtils";

interface KwhBreakdownPanelProps {
  filteredSessions: ChargingSession[];
  selectedVehicles: string[];
  selectedChargers: string[];
  dateRange: string;
  vehicles?: VehicleStats[];
  chargers?: ChargerStats[];
}

const KWH_PER_PERCENT = 2.36; // 236 kWh battery / 100

type Row = {
  id: string;
  name: string;
  color: string;
  sessions: number;
  kwh: number;
};

const formatKwh = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const BreakdownCard = ({
  title,
  subtitle,
  icon: Icon,
  rows,
  total,
  sessionsLabel,
}: {
  title: string;
  subtitle: string;
  icon: typeof Battery;
  rows: Row[];
  total: number;
  sessionsLabel: string;
}) => {
  const max = Math.max(...rows.map((r) => r.kwh), 1);

  return (
    <div className="elonroad-card p-4 sm:p-6 animate-slide-up">
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-5 h-5 text-primary" />
          <h3 className="text-lg sm:text-xl font-bold text-foreground">{title}</h3>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="space-y-3">
        {rows.map((row) => {
          const share = total > 0 ? (row.kwh / total) * 100 : 0;
          const widthPct = (row.kwh / max) * 100;
          return (
            <div key={row.id}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="text-sm font-medium text-foreground truncate">
                    {row.name}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    · {row.sessions} {sessionsLabel}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {formatKwh(row.kwh)} kWh
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                    {share.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: row.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Total</span>
        <span className="text-base font-bold text-primary tabular-nums">
          {formatKwh(total)} kWh
        </span>
      </div>
    </div>
  );
};

export const KwhBreakdownPanel = ({
  filteredSessions,
  selectedVehicles,
  selectedChargers,
  dateRange,
  vehicles = [],
  chargers = [],
}: KwhBreakdownPanelProps) => {
  const { t, language } = useLanguage();

  const sessionsForBreakdown = useMemo(
    () =>
      filteredSessions.filter(
        (s) =>
          (selectedVehicles.length === 0 || selectedVehicles.includes(s.vehicleId)) &&
          (selectedChargers.length === 0 || selectedChargers.includes(s.chargerId))
      ),
    [filteredSessions, selectedVehicles, selectedChargers]
  );

  const vehicleRows: Row[] = useMemo(() => {
    const activeIds =
      selectedVehicles.length === 0 ? vehicles.map((v) => v.id) : selectedVehicles;
    return vehicles
      .filter((v) => activeIds.includes(v.id))
      .map((v) => {
        const vSessions = sessionsForBreakdown.filter((s) => s.vehicleId === v.id);
        const kwh = vSessions.reduce((sum, s) => sum + s.chargeAdded * KWH_PER_PERCENT, 0);
        return {
          id: v.id,
          name: v.name,
          color: v.color,
          sessions: vSessions.length,
          kwh,
        };
      })
      .sort((a, b) => b.kwh - a.kwh);
  }, [sessionsForBreakdown, selectedVehicles, vehicles]);

  const chargerRows: Row[] = useMemo(() => {
    const activeIds =
      selectedChargers.length === 0 ? chargers.map((c) => c.id) : selectedChargers;
    return chargers
      .filter((c) => activeIds.includes(c.id))
      .map((c) => {
        const cSessions = sessionsForBreakdown.filter((s) => s.chargerId === c.id);
        const kwh = cSessions.reduce((sum, s) => sum + s.chargeAdded * KWH_PER_PERCENT, 0);
        return {
          id: c.id,
          name: c.name.replace(" Power Rail", ""),
          color: c.color,
          sessions: cSessions.length,
          kwh,
        };
      })
      .sort((a, b) => b.kwh - a.kwh);
  }, [sessionsForBreakdown, selectedChargers, chargers]);

  const totalVehicleKwh = vehicleRows.reduce((sum, r) => sum + r.kwh, 0);
  const totalChargerKwh = chargerRows.reduce((sum, r) => sum + r.kwh, 0);
  const sessionsLabel = language === "en" ? "sessions" : "sessioner";

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            exportKwhBreakdownToCSV(
              filteredSessions,
              selectedVehicles,
              selectedChargers,
              dateRange,
              vehicles,
              chargers
            )
          }
          className="gap-1.5 h-9"
        >
          <Download className="w-4 h-4" />
          {t("breakdown.export")}
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <BreakdownCard
          title={t("breakdown.title.vehicle")}
          subtitle={t("breakdown.subtitle")}
          icon={Battery}
          rows={vehicleRows}
          total={totalVehicleKwh}
          sessionsLabel={sessionsLabel}
        />
        <BreakdownCard
          title={t("breakdown.title.charger")}
          subtitle={t("breakdown.subtitle")}
          icon={Zap}
          rows={chargerRows}
          total={totalChargerKwh}
          sessionsLabel={sessionsLabel}
        />
      </div>
    </div>
  );
};
