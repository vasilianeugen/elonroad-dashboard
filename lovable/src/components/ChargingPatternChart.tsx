import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
} from "recharts";
import { useMemo } from "react";
import type { ChargingSession, VehicleStats } from "@/types/dashboard";
import { filterSessionsByDateRange, KWH_PER_PERCENT } from "@/lib/dashboardData";
import { useLanguage } from "@/contexts/LanguageContext";

interface ChargingPatternChartProps {
  selectedVehicles: string[];
  dateRange: string;
  customStart?: Date;
  customEnd?: Date;
  vehicles?: VehicleStats[];
  sessions?: ChargingSession[];
  speedUnit?: string;
}

const CustomTooltip = ({ active, payload }: any) => {
  const { language } = useLanguage();
  
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-foreground mb-2">{data.name}</p>
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            {language === "en" ? "Avg Speed:" : "Snitt hastighet:"}{" "}
            <span className="text-foreground font-medium">{data.avgChargingSpeed.toFixed(3)} {data.speedUnit}</span>
          </p>
          <p className="text-muted-foreground">
            {language === "en" ? "Avg Time:" : "Snitt tid:"}{" "}
            <span className="text-foreground font-medium">{data.avgSessionTime.toFixed(0)} min</span>
          </p>
          <p className="text-muted-foreground">
            {language === "en" ? "Sessions:" : "Sessioner:"}{" "}
            <span className="text-foreground font-medium">{data.totalSessions}</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export const ChargingPatternChart = ({
  selectedVehicles,
  dateRange,
  customStart,
  customEnd,
  vehicles = [],
  sessions = [],
  speedUnit = "%SoC/min",
}: ChargingPatternChartProps) => {
  const { language } = useLanguage();

  const filteredData = useMemo(() => {
    const selectedVehicleRows = vehicles.filter(
      (v) => selectedVehicles.length === 0 || selectedVehicles.includes(v.id)
    );

    if (sessions.length === 0) {
      return selectedVehicleRows.map((v) => ({
        ...v,
        speedUnit,
      }));
    }

    const sessionsInRange = filterSessionsByDateRange(sessions, dateRange, customStart, customEnd);
    return selectedVehicleRows.map((vehicle) => {
      const vehicleSessions = sessionsInRange.filter((session) => session.vehicleId === vehicle.id);
      const totalDuration = vehicleSessions.reduce((sum, session) => sum + session.duration, 0);
      const totalKwh = vehicleSessions.reduce(
        (sum, session) => sum + session.chargeAdded * KWH_PER_PERCENT,
        0
      );

      return {
        ...vehicle,
        totalCharge: totalKwh,
        totalSessions: vehicleSessions.length,
        avgSessionTime: vehicleSessions.length > 0 ? totalDuration / vehicleSessions.length : 0,
        avgChargingSpeed: totalDuration > 0 ? totalKwh / totalDuration : 0,
        speedUnit,
      };
    });
  }, [customEnd, customStart, dateRange, selectedVehicles, sessions, speedUnit, vehicles]);

  const maxTime = Math.max(...filteredData.map((v) => v.avgSessionTime), 1);
  const maxSpeed = Math.max(...filteredData.map((v) => v.avgChargingSpeed), 1);
  const highestUsage = [...filteredData].sort((a, b) => b.totalCharge - a.totalCharge)[0];
  const mostSessions = [...filteredData].sort((a, b) => b.totalSessions - a.totalSessions)[0];

  return (
    <div className="elonroad-card p-6 animate-slide-up">
      <div className="mb-6">
        <h3 className="section-header">
          {language === "en" ? "Charging Patterns and Efficiency" : "Laddningsmönster och Effektivitet"}
        </h3>
        <p className="section-subheader">
          {language === "en" 
            ? "Charging patterns: Speed vs Duration (bubble size = sessions)" 
            : "Laddningsmönster: Hastighet vs Tid (bubbelstorlek = sessioner)"}
        </p>
      </div>

      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 30, left: 30, bottom: 20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(220 15% 88%)"
            />
            <XAxis
              type="number"
              dataKey="avgSessionTime"
              name="Avg Session Time"
              unit=" min"
              domain={[0, Math.ceil(maxTime * 1.1)]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(220 15% 45%)", fontSize: 12 }}
              label={{
                value: language === "en" ? "Avg Session Time (minutes)" : "Snitt sessionstid (minuter)",
                position: "bottom",
                offset: 0,
                fill: "hsl(220 15% 45%)",
                fontSize: 12,
              }}
            />
            <YAxis
              type="number"
              dataKey="avgChargingSpeed"
              name="Avg Speed"
              domain={[0, Math.ceil(maxSpeed * 10) / 10 || 1]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(220 15% 45%)", fontSize: 12 }}
              tickFormatter={(value) => value.toFixed(2)}
              label={{
                value: language === "en" ? `Avg Speed (${speedUnit})` : `Snitt hastighet (${speedUnit})`,
                angle: -90,
                position: "insideLeft",
                offset: -10,
                fill: "hsl(220 15% 45%)",
                fontSize: 12,
                dy: 60,
              }}
            />
            <ZAxis
              type="number"
              dataKey="totalSessions"
              range={[200, 800]}
              name="Sessions"
            />
            <Tooltip content={<CustomTooltip />} />
            {filteredData.map((vehicle) => (
              <Scatter
                key={vehicle.id}
                name={vehicle.name}
                data={[vehicle]}
                fill={vehicle.color}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-secondary/50 rounded-lg">
            <p className="text-muted-foreground mb-1">
              {language === "en" ? "Highest Usage" : "Högst användning"}
            </p>
            <p className="font-medium text-foreground">
              {highestUsage
                ? `${highestUsage.name}: ${highestUsage.totalCharge.toFixed(1)} ${speedUnit === "kWh/min" ? "kWh" : "%SoC"} ${language === "en" ? "total" : "totalt"}, ${highestUsage.totalSessions} ${language === "en" ? "sessions" : "sessioner"}`
                : language === "en" ? "No live vehicle data" : "Ingen live fordonsdata"}
            </p>
          </div>
          <div className="p-3 bg-secondary/50 rounded-lg">
            <p className="text-muted-foreground mb-1">
              {language === "en" ? "Most Sessions" : "Flest sessioner"}
            </p>
            <p className="font-medium text-foreground">
              {mostSessions
                ? `${mostSessions.name}: ${mostSessions.totalSessions} ${language === "en" ? "sessions" : "sessioner"}, ${mostSessions.totalCharge.toFixed(1)} ${speedUnit === "kWh/min" ? "kWh" : "%SoC"} ${language === "en" ? "total" : "totalt"}`
                : language === "en" ? "No live sessions" : "Inga live sessioner"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
