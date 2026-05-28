import { useState, useMemo, useCallback, useEffect } from "react";
import { Battery, Clock, Activity, FileText, Info, Gauge, Zap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import elonroadLogo from "@/assets/elonroad-logo.png";
import { ElonroadHeader } from "@/components/ElonroadHeader";
import { MetricCard } from "@/components/MetricCard";
import { VehicleSelector } from "@/components/VehicleSelector";
import { ChargerSelector } from "@/components/ChargerSelector";
import { DateRangeControl } from "@/components/DateRangeControl";
import { EnergyBarChart } from "@/components/EnergyBarChart";
import { ChargingPatternChart } from "@/components/ChargingPatternChart";
import { DailyTrendChart } from "@/components/DailyTrendChart";
import { CumulativeAreaChart } from "@/components/CumulativeAreaChart";
import { VehicleDataTable } from "@/components/VehicleDataTable";
import { ChargerTable } from "@/components/ChargerTable";
import { InsightsPanel } from "@/components/InsightsPanel";
import { ExportButton } from "@/components/ExportButton";

import { SessionDetailsTable } from "@/components/SessionDetailsTable";
import { KwhBreakdownPanel } from "@/components/KwhBreakdownPanel";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEnergyDashboardData } from "@/hooks/useEnergyDashboardData";
import {
  type ChargerStats,
  type ChargingSession,
  type VehicleStats,
} from "@/types/dashboard";
import {
  KWH_PER_PERCENT,
  calculateSessionStats,
  filterSessionsByDateRange,
  formatPeriodDate,
  getDateBounds,
  splitIsoDateTime,
  toNumber,
} from "@/lib/dashboardData";
import { exportSessionsToCSV, exportVehicleSummaryToCSV, exportEnergyReportToCSV } from "@/utils/exportUtils";

const LIVE_COLORS = [
  "hsl(200 80% 50%)",
  "hsl(152 60% 42%)",
  "hsl(16 85% 55%)",
  "hsl(280 60% 55%)",
  "hsl(340 70% 50%)",
  "hsl(45 85% 50%)",
];

const MIN_CHARGING_SESSION_KWH = 0.0001;

const atNoon = (iso: string) => new Date(`${iso}T12:00:00`);

const Index = () => {
  const { t } = useLanguage();
  const { data: liveData, isLoading: liveLoading, isError: liveError, refetch, dataUpdatedAt } = useEnergyDashboardData();
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [selectedChargers, setSelectedChargers] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState("all");
  const [customStart, setCustomStart] = useState<Date | undefined>(undefined);
  const [customEnd, setCustomEnd] = useState<Date | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);
  const [liveSelectionInitialized, setLiveSelectionInitialized] = useState(false);

  const liveVehicles = useMemo<VehicleStats[]>(() => {
    const rows = liveData?.vehicles ?? [];
    if (rows.length === 0) return [];

    const byVehicle = new Map<
      string,
      {
        id: string;
        name: string;
        totalEnergyKwh: number;
        totalDurationMinutes: number;
        totalSessions: number;
      }
    >();

    rows.forEach((row) => {
      const current = byVehicle.get(row.vehicle_id);
      const sessions = row.total_sessions;
      const totalEnergyKwh = toNumber(row.total_energy_kwh);
      const averageDuration = toNumber(row.average_duration_minutes);
      const next = current ?? {
        id: row.vehicle_id,
        name: row.vehicle_name || row.vehicle_id,
        totalEnergyKwh: 0,
        totalDurationMinutes: 0,
        totalSessions: 0,
      };

      next.name = row.vehicle_name || next.name;
      next.totalEnergyKwh += totalEnergyKwh;
      next.totalDurationMinutes += averageDuration * sessions;
      next.totalSessions += sessions;
      byVehicle.set(row.vehicle_id, next);
    });

    return Array.from(byVehicle.values()).map((row, index) => {
      const avgSessionTime =
        row.totalSessions > 0 ? row.totalDurationMinutes / row.totalSessions : 0;
      return {
        id: row.id,
        name: row.name,
        totalCharge: row.totalEnergyKwh,
        avgChargingSpeed: avgSessionTime > 0 ? row.totalEnergyKwh / avgSessionTime : 0,
        avgSessionTime,
        totalSessions: row.totalSessions,
        color: LIVE_COLORS[index % LIVE_COLORS.length],
      };
    });
  }, [liveData?.vehicles]);

  const liveChargers = useMemo<ChargerStats[]>(() => {
    const rows = liveData?.chargers ?? [];
    const sessionRows = liveData?.sessions ?? [];
    if (rows.length === 0 && sessionRows.length === 0) return [];

    const byCharger = new Map<
      string,
      {
        id: string;
        name: string;
        totalEnergyKwh: number;
        totalDurationMinutes: number;
        totalSessions: number;
        hasSessionData: boolean;
      }
    >();

    rows.forEach((row) => {
      const current = byCharger.get(row.charger_id);
      const sessions = row.total_sessions;
      const totalEnergyKwh = toNumber(row.total_energy_kwh);
      const averageDuration = toNumber(row.average_duration_minutes);
      const next = current ?? {
        id: row.charger_id,
        name: row.charger_name || row.charger_id,
        totalEnergyKwh: 0,
        totalDurationMinutes: 0,
        totalSessions: 0,
        hasSessionData: false,
      };

      next.name = row.charger_name || next.name;
      next.totalEnergyKwh += totalEnergyKwh;
      next.totalDurationMinutes += averageDuration * sessions;
      next.totalSessions += sessions;
      byCharger.set(row.charger_id, next);
    });

    sessionRows.forEach((row) => {
      const chargerId = row.host_name;
      const energyKwh = toNumber(row.energy_kwh);
      if (!chargerId || energyKwh <= MIN_CHARGING_SESSION_KWH) return;

      const current = byCharger.get(chargerId);
      const durationMinutes = toNumber(row.duration_minutes);
      const next = current ?? {
        id: chargerId,
        name: chargerId,
        totalEnergyKwh: 0,
        totalDurationMinutes: 0,
        totalSessions: 0,
        hasSessionData: true,
      };

      if (!next.hasSessionData) {
        next.totalEnergyKwh = 0;
        next.totalDurationMinutes = 0;
        next.totalSessions = 0;
        next.hasSessionData = true;
      }

      next.name = next.name || chargerId;
      next.totalEnergyKwh += energyKwh;
      next.totalDurationMinutes += durationMinutes;
      next.totalSessions += 1;
      byCharger.set(chargerId, next);
    });

    return Array.from(byCharger.values()).map((row, index) => {
      const avgSessionLength =
        row.totalSessions > 0 ? row.totalDurationMinutes / row.totalSessions : 0;
      return {
        id: row.id,
        name: row.name,
        totalCharge: row.totalEnergyKwh,
        avgChargingSpeed: avgSessionLength > 0 ? row.totalEnergyKwh / avgSessionLength : 0,
        totalSessions: row.totalSessions,
        avgSessionLength,
        color: LIVE_COLORS[(index + 2) % LIVE_COLORS.length],
      };
    });
  }, [liveData?.chargers, liveData?.sessions]);

  const liveSessions = useMemo<ChargingSession[]>(() => {
    const rows = liveData?.sessions ?? [];
    if (rows.length === 0) return [];

    return rows.flatMap((row) => {
      const start = splitIsoDateTime(row.started_at);
      const end = splitIsoDateTime(row.ended_at ?? row.started_at);
      const energyKwh = toNumber(row.energy_kwh);
      if (energyKwh <= MIN_CHARGING_SESSION_KWH) return [];
      return {
        id: row.session_id,
        vehicleId: row.vehicle_id,
        chargerId: row.host_name,
        date: start.date,
        startTime: start.time,
        endTime: end.time,
        startSoC: 0,
        endSoC: energyKwh / KWH_PER_PERCENT,
        chargeAdded: energyKwh / KWH_PER_PERCENT,
        chargingSpeed: toNumber(row.duration_minutes) > 0 ? energyKwh / KWH_PER_PERCENT / toNumber(row.duration_minutes) : 0,
        duration: toNumber(row.duration_minutes),
      };
    });
  }, [liveData?.sessions]);

  const zeroEnergySessionCount = useMemo(
    () => (liveData?.sessions ?? []).filter((row) => toNumber(row.energy_kwh) <= MIN_CHARGING_SESSION_KWH).length,
    [liveData?.sessions]
  );

  const hasApiResponse = Boolean(liveData);
  const dateBounds = useMemo(() => {
    const sessionBounds = getDateBounds(liveSessions);
    const aggregateDates = (liveData?.daily ?? []).map((row) => row.event_date);
    const allDates = [sessionBounds.startIso, sessionBounds.endIso, ...aggregateDates]
      .filter(Boolean)
      .sort() as string[];
    const startIso = allDates[0];
    const endIso = allDates[allDates.length - 1];
    return {
      startIso,
      endIso,
      startDate: startIso ? atNoon(startIso) : undefined,
      endDate: endIso ? atNoon(endIso) : undefined,
    };
  }, [liveData?.daily, liveSessions]);
  const periodLabel =
    dateBounds.startIso && dateBounds.endIso
      ? `${formatPeriodDate(dateBounds.startIso)} - ${formatPeriodDate(dateBounds.endIso)}`
      : "No database sessions";

  useEffect(() => {
    if (!hasApiResponse || liveSelectionInitialized) return;
    setSelectedVehicles(Array.from(new Set(liveVehicles.map((v) => v.id))));
    setSelectedChargers(Array.from(new Set(liveChargers.map((c) => c.id))));
    setLiveSelectionInitialized(true);
  }, [hasApiResponse, liveChargers, liveSelectionInitialized, liveVehicles]);

  const handleRecompute = useCallback(() => {
    setSelectedVehicles(Array.from(new Set(liveVehicles.map((v) => v.id))));
    setSelectedChargers(Array.from(new Set(liveChargers.map((c) => c.id))));
    setDateRange("all");
    setCustomStart(undefined);
    setCustomEnd(undefined);
    setRefreshKey((k) => k + 1);
    void refetch();
    toast.success(
      t("actions.recomputed")
        .replace("{sessions}", String(liveSessions.length))
        .replace("{start}", dateBounds.startIso ?? "n/a")
        .replace("{end}", dateBounds.endIso ?? "n/a")
    );
  }, [dateBounds.endIso, dateBounds.startIso, liveChargers, liveSessions.length, liveVehicles, refetch, t]);
  
  // Filter sessions by date range and calculate stats
  const { filteredSessions, stats } = useMemo(() => {
    const filtered = filterSessionsByDateRange(liveSessions, dateRange, customStart, customEnd);
    const calculatedStats = calculateSessionStats(filtered, selectedVehicles, selectedChargers);
    return { filteredSessions: filtered, stats: calculatedStats };
  }, [liveSessions, selectedVehicles, selectedChargers, dateRange, customStart, customEnd]);

  const filteredSelectedSessions = useMemo(
    () =>
      filteredSessions.filter(
        (session) =>
          (selectedVehicles.length === 0 || selectedVehicles.includes(session.vehicleId)) &&
          (selectedChargers.length === 0 || selectedChargers.includes(session.chargerId))
      ),
    [filteredSessions, selectedChargers, selectedVehicles]
  );

  const filteredEnergyKwh = useMemo(
    () => filteredSelectedSessions.reduce((sum, session) => sum + session.chargeAdded * KWH_PER_PERCENT, 0),
    [filteredSelectedSessions]
  );

  const filteredVehicleStats = useMemo<VehicleStats[]>(() => {
    return liveVehicles.map((vehicle) => {
      const vehicleSessions = filteredSelectedSessions.filter((session) => session.vehicleId === vehicle.id);
      const totalDuration = vehicleSessions.reduce((sum, session) => sum + session.duration, 0);
      const totalEnergyKwh = vehicleSessions.reduce(
        (sum, session) => sum + session.chargeAdded * KWH_PER_PERCENT,
        0
      );

      return {
        ...vehicle,
        totalCharge: totalEnergyKwh,
        totalSessions: vehicleSessions.length,
        avgSessionTime: vehicleSessions.length > 0 ? totalDuration / vehicleSessions.length : 0,
        avgChargingSpeed: totalDuration > 0 ? totalEnergyKwh / totalDuration : 0,
      };
    });
  }, [filteredSelectedSessions, liveVehicles]);

  const filteredChargerStats = useMemo<ChargerStats[]>(() => {
    return liveChargers.map((charger) => {
      const chargerSessions = filteredSelectedSessions.filter((session) => session.chargerId === charger.id);
      const totalDuration = chargerSessions.reduce((sum, session) => sum + session.duration, 0);
      const totalEnergyKwh = chargerSessions.reduce(
        (sum, session) => sum + session.chargeAdded * KWH_PER_PERCENT,
        0
      );

      return {
        ...charger,
        totalCharge: totalEnergyKwh,
        totalSessions: chargerSessions.length,
        avgSessionLength: chargerSessions.length > 0 ? totalDuration / chargerSessions.length : 0,
        avgChargingSpeed: totalDuration > 0 ? totalEnergyKwh / totalDuration : 0,
      };
    });
  }, [filteredSelectedSessions, liveChargers]);

  const filteredVehicles = filteredVehicleStats.filter(
    (v) => selectedVehicles.length === 0 || selectedVehicles.includes(v.id)
  );

  // Keep KPI totals aligned with the visible session table and charts.
  const displayStats = {
    totalCharge: filteredEnergyKwh,
    totalSessions: stats.totalSessions,
    avgChargingSpeed: stats.avgTime > 0 ? filteredEnergyKwh / stats.avgTime : 0,
    avgTime: stats.avgTime,
  };

  const handleExportSessions = useCallback(() => {
    exportSessionsToCSV(filteredSelectedSessions, selectedVehicles, selectedChargers, dateRange, liveVehicles, liveChargers);
  }, [filteredSelectedSessions, selectedVehicles, selectedChargers, dateRange, liveVehicles, liveChargers]);

  const handleExportSummary = useCallback(() => {
    exportVehicleSummaryToCSV(filteredVehicles, dateRange);
  }, [filteredVehicles, dateRange]);

  const handleExportEnergy = useCallback(() => {
    exportEnergyReportToCSV(filteredSelectedSessions, liveVehicles, liveChargers);
  }, [filteredSelectedSessions, liveChargers, liveVehicles]);

  const getDaysLabel = () => {
    if (dateRange === "7d") return "7";
    if (dateRange === "14d") return "14";
    return "30";
  };

  return (
    <div className="min-h-screen bg-background">
      <ElonroadHeader periodLabel={periodLabel} />

      <main key={refreshKey} className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-8">
        {/* Hero Section */}
        <div className="mb-6 sm:mb-8 animate-fade-in">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <FileText className="w-5 sm:w-6 h-5 sm:h-6 text-primary" />
            <span className="text-xs sm:text-sm font-medium text-primary uppercase tracking-wide">
              {t("hero.draft")}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
            {t("hero.title")}
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-3xl">
            {t("hero.description")
              .replace("{sessions}", String(liveSessions.length))
              .replace("{zero}", "0")
              .replace("{vehicles}", String(liveVehicles.length))
              .replace("{chargers}", String(liveChargers.length))}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5">
            <Battery className="w-4 h-4 text-primary" />
            <span className="text-xs sm:text-sm font-medium text-foreground">
              {t("hero.batteryInfo")}
            </span>
          </div>
        </div>

        {/* Control Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <VehicleSelector
            selectedVehicles={selectedVehicles}
            onSelectionChange={setSelectedVehicles}
            vehicles={liveVehicles}
          />
          <ChargerSelector
            selectedChargers={selectedChargers}
            onSelectionChange={setSelectedChargers}
            chargers={liveChargers}
          />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <DateRangeControl
            selectedRange={dateRange}
            onRangeChange={setDateRange}
            customStart={customStart}
            customEnd={customEnd}
            onCustomDateChange={(start, end) => {
              setCustomStart(start);
              setCustomEnd(end);
            }}
            minDate={dateBounds.startDate}
            maxDate={dateBounds.endDate}
          />
          <div className="flex items-end justify-start sm:justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecompute}
              className="gap-1.5 h-9"
              title={periodLabel}
            >
              <RefreshCw className="w-4 h-4" />
              {t("actions.recompute")}
            </Button>
            <ExportButton
              onExportSessions={handleExportSessions}
              onExportSummary={handleExportSummary}
              onExportEnergy={handleExportEnergy}
            />
          </div>
        </div>

        {/* Data Source Indicator */}
        <div className="mb-4 flex items-start sm:items-center gap-2 text-xs sm:text-sm text-muted-foreground bg-secondary/50 rounded-lg p-2.5 sm:p-3">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5 sm:mt-0" />
          <span>
            {hasApiResponse
              ? `Live Docker API data from ${liveData?.now.host_name ?? "backend"}${dataUpdatedAt ? `, refreshed ${new Date(dataUpdatedAt).toLocaleTimeString()}` : ""}. Loaded ${liveData?.daily.length ?? 0} daily rows, ${liveData?.vehicles.length ?? 0} vehicle rows, ${liveData?.chargers.length ?? 0} charger rows, and ${liveSessions.length} charging sessions${zeroEnergySessionCount ? ` (${zeroEnergySessionCount} zero-energy state sessions ignored)` : ""}.`
              : liveLoading
                ? "Loading live data from the local Docker API..."
                : liveError
                  ? "Local Docker API is not reachable; no fallback data is shown."
                  : "No database aggregates yet; no fallback data is shown."}
          </span>
        </div>

        {/* Date Filter Indicator */}
        {dateRange !== "all" && (
          <div className="mb-4 flex items-start sm:items-center gap-2 text-xs sm:text-sm text-muted-foreground bg-secondary/50 rounded-lg p-2.5 sm:p-3">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5 sm:mt-0" />
            <span>
              {dateRange === "custom" && customStart && customEnd
                ? `${t("dataSource.showing").split("{days}")[0]}${customStart.toLocaleDateString()} – ${customEnd.toLocaleDateString()} (${stats.totalSessions} ${t("metrics.chargingSessions").toLowerCase()})`
                : t("dataSource.showing")
                    .replace("{days}", getDaysLabel())
                    .replace("{sessions}", String(stats.totalSessions))}
            </span>
          </div>
        )}

        {/* Metrics Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <MetricCard
            title={t("metrics.totalCharge")}
            value={displayStats.totalCharge.toFixed(1)}
            unit="kWh"
            icon={Battery}
            subtitle={t("metrics.fromVehicles").replace("{count}", String(filteredVehicles.length))}
            highlight
          />
          <MetricCard
            title={t("metrics.totalSessions")}
            value={displayStats.totalSessions}
            icon={Activity}
            subtitle={t("metrics.chargingSessions")}
          />
          <MetricCard
            title={t("metrics.avgChargingSpeed")}
            value={displayStats.avgChargingSpeed.toFixed(3)}
            unit="kWh/min"
            icon={Gauge}
            subtitle={t("metrics.perMinute")}
          />
          <MetricCard
            title={t("metrics.avgSessionTime")}
            value={displayStats.avgTime.toFixed(0)}
            unit="min"
            icon={Clock}
            subtitle={t("metrics.minutes").replace("{value}", displayStats.avgTime.toFixed(1))}
          />
        </div>

        {/* Vehicle Spec Info */}
        <div className="mb-6 sm:mb-8 elonroad-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Battery className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                {t("spec.title")}
              </h3>
              <p className="text-xs text-muted-foreground">{t("spec.subtitle")}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-1 gap-3 sm:gap-6 sm:justify-end">
            <div>
              <p className="text-xs text-muted-foreground">{t("spec.batteryCapacity")}</p>
              <p className="text-base sm:text-lg font-bold text-primary tabular-nums">236 kWh</p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    {t("spec.kwhPerSoc")}
                    <Info className="w-3 h-3" />
                  </p>
                  <p className="text-base sm:text-lg font-bold text-foreground tabular-nums underline decoration-dotted decoration-muted-foreground/50 underline-offset-4">
                    2.36 kWh
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">{t("spec.kwhPerSocTooltip")}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* kWh Breakdown */}
        <div className="mb-6 sm:mb-8">
          <KwhBreakdownPanel
            filteredSessions={filteredSessions}
            selectedVehicles={selectedVehicles}
            selectedChargers={selectedChargers}
            dateRange={dateRange}
            vehicles={liveVehicles}
            chargers={liveChargers}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <EnergyBarChart 
            selectedVehicles={selectedVehicles} 
            dateRange={dateRange}
            customStart={customStart}
            customEnd={customEnd}
            vehicles={filteredVehicleStats}
            sessions={filteredSelectedSessions}
            unit="kWh"
          />
          <ChargingPatternChart
            selectedVehicles={selectedVehicles}
            dateRange={dateRange}
            customStart={customStart}
            customEnd={customEnd}
            vehicles={filteredVehicleStats}
            sessions={filteredSelectedSessions}
            speedUnit="kWh/min"
          />
        </div>

        {/* Daily Trend Chart */}
        <div className="mb-6 sm:mb-8">
          <DailyTrendChart 
            selectedVehicles={selectedVehicles} 
            dateRange={dateRange}
            customStart={customStart}
            customEnd={customEnd}
            sessions={filteredSelectedSessions}
            vehicles={filteredVehicleStats}
            unit="kWh"
          />
        </div>

        {/* Cumulative Area Chart */}
        <div className="mb-6 sm:mb-8">
          <CumulativeAreaChart 
            selectedVehicles={selectedVehicles} 
            dateRange={dateRange}
            customStart={customStart}
            customEnd={customEnd}
            sessions={filteredSelectedSessions}
            vehicles={filteredVehicleStats}
            unit="kWh"
          />
        </div>

        {/* Session Details Table */}
        <div className="mb-6 sm:mb-8">
          <SessionDetailsTable 
            selectedVehicles={selectedVehicles}
            selectedChargers={selectedChargers}
            sessions={filteredSessions}
            vehicles={liveVehicles}
            chargers={liveChargers}
          />
        </div>

        {/* Data Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <VehicleDataTable
            selectedVehicles={selectedVehicles}
            vehicles={filteredVehicleStats}
            valueUnit="kWh"
            speedUnit="kWh/min"
          />
          <ChargerTable
            chargers={filteredChargerStats}
            speedUnit="kWh/min"
          />
        </div>


        {/* Insights */}
        <InsightsPanel
          sessions={filteredSelectedSessions}
          vehicles={filteredVehicleStats}
          chargers={filteredChargerStats}
          startIso={dateBounds.startIso}
          endIso={dateBounds.endIso}
        />

        {/* Footer */}
        <footer className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-border">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <img src={elonroadLogo} alt="Elonroad" className="h-5 w-auto" />
              <span className="font-bold text-foreground">Elonroad</span>
              <span>{t("header.dataAnalysis")}</span>
            </div>
            <p>{t("footer.copyright")}</p>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Index;
