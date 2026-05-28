import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers } from "lucide-react";
import type { ChargingSession, VehicleStats } from "@/types/dashboard";
import type { DailyEnergyAggregate } from "@/lib/energyApi";
import { getDailyChargeData, KWH_PER_PERCENT, toNumber } from "@/lib/dashboardData";
import { useLanguage } from "@/contexts/LanguageContext";

interface CumulativeAreaChartProps {
  selectedVehicles: string[];
  dateRange: string;
  customStart?: Date;
  customEnd?: Date;
  sessions?: ChargingSession[];
  vehicles?: VehicleStats[];
  dailyAggregates?: DailyEnergyAggregate[];
  unit?: "kWh" | "%SoC";
}

export const CumulativeAreaChart = ({
  selectedVehicles,
  dateRange,
  customStart,
  customEnd,
  sessions = [],
  vehicles = [],
  dailyAggregates = [],
  unit = "%SoC",
}: CumulativeAreaChartProps) => {
  const { language } = useLanguage();

  const data = useMemo(() => {
    const aggregateRows = getAggregateDailyData(dailyAggregates, dateRange, customStart, customEnd, unit);
    if (aggregateRows.length > 0) {
      let cumulativeTotal = 0;
      return aggregateRows.map((day) => {
        cumulativeTotal += day.total;
        return {
          date: day.date,
          aggregateTotal: cumulativeTotal,
          total: cumulativeTotal,
        };
      });
    }

    const activeVehicleIds =
      selectedVehicles.length > 0
        ? selectedVehicles
        : vehicles.length > 0
          ? vehicles.map((vehicle) => vehicle.id)
          : Array.from(new Set(sessions.map((session) => session.vehicleId)));

    const dailyData = fillMissingDailyRows(
      getDailyChargeData(sessions, selectedVehicles, dateRange, customStart, customEnd, unit),
      activeVehicleIds,
      dateRange,
      customStart,
      customEnd
    );
    
    // Calculate cumulative values
    const cumulative: Record<string, number> = {};
    return dailyData.map((day) => {
      const cumulativeDay: Record<string, number | string> = { date: day.date };
      
      activeVehicleIds.forEach((vehicleId) => {
        if (!cumulative[vehicleId]) cumulative[vehicleId] = 0;
        cumulative[vehicleId] += (day[vehicleId] as number) || 0;
        cumulativeDay[vehicleId] = cumulative[vehicleId];
      });
      
      cumulativeDay.total = Object.values(cumulative).reduce((sum, val) => sum + val, 0);
      return cumulativeDay;
    });
  }, [dailyAggregates, sessions, selectedVehicles, vehicles, dateRange, customStart, customEnd, unit]);

  const filteredVehicles = vehicles.filter(
    (v) => selectedVehicles.length === 0 || selectedVehicles.includes(v.id)
  );
  const usingAggregateSeries = data.some((row) => "aggregateTotal" in row);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString(language === "en" ? "en-US" : "sv-SE", { month: "short", day: "numeric" });
  };
  const formatCharge = (value: number) => {
    if (value === 0) return "0";
    if (Math.abs(value) < 1) return value.toFixed(3);
    return value.toFixed(0);
  };

  const totalCumulative = data.length > 0 ? (data[data.length - 1].total as number) : 0;

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              {language === "en" ? "Cumulative Charge" : "Kumulativ Laddning"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {language === "en" ? "Total accumulated charge over time" : "Total ackumulerad laddning över tid"}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              {formatCharge(totalCumulative)} {unit}
            </div>
            <div className="text-xs text-muted-foreground">{language === "en" ? "total" : "totalt"}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                {usingAggregateSeries ? (
                  <linearGradient
                    id="gradient-aggregateTotal"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="hsl(200 80% 50%)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="hsl(200 80% 50%)" stopOpacity={0.1} />
                  </linearGradient>
                ) : filteredVehicles.map((vehicle) => (
                  <linearGradient
                    key={`gradient-${vehicle.id}`}
                    id={`gradient-${vehicle.id}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={vehicle.color} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={vehicle.color} stopOpacity={0.1} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCharge(value)}
                label={{
                  value: unit,
                  angle: -90,
                  position: "insideLeft",
                  style: { textAnchor: "middle", fill: "hsl(var(--muted-foreground))" },
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
                labelFormatter={(label) => {
                  const date = new Date(label);
                  return date.toLocaleDateString(language === "en" ? "en-US" : "sv-SE", {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  });
                }}
                formatter={(value: number, name: string) => {
                  if (name === "aggregateTotal") {
                    return [`${value.toFixed(1)} ${unit}`, language === "en" ? "Database aggregate" : "Databasaggregat"];
                  }
                  const vehicle = vehicles.find((v) => v.id === name);
                  return [`${value.toFixed(1)} ${unit}`, vehicle?.name || name];
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => {
                  if (value === "aggregateTotal") {
                    return language === "en" ? "Database aggregate" : "Databasaggregat";
                  }
                  const vehicle = vehicles.find((v) => v.id === value);
                  return vehicle?.name || value;
                }}
              />
              {usingAggregateSeries ? (
                <Area
                  type="monotone"
                  dataKey="aggregateTotal"
                  name="aggregateTotal"
                  stackId="1"
                  stroke="hsl(200 80% 50%)"
                  fill="url(#gradient-aggregateTotal)"
                  strokeWidth={2}
                />
              ) : filteredVehicles.map((vehicle) => (
                <Area
                  key={vehicle.id}
                  type="monotone"
                  dataKey={vehicle.id}
                  name={vehicle.id}
                  stackId="1"
                  stroke={vehicle.color}
                  fill={`url(#gradient-${vehicle.id})`}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

const atNoon = (iso: string) => new Date(`${iso}T12:00:00`);

function getAggregateDailyData(
  rows: DailyEnergyAggregate[],
  dateRange: string,
  customStart: Date | undefined,
  customEnd: Date | undefined,
  unit: "kWh" | "%SoC"
) {
  const sortedRows = [...rows].sort((a, b) => a.event_date.localeCompare(b.event_date));
  const endIso = sortedRows[sortedRows.length - 1]?.event_date;

  return sortedRows
    .filter((row) => isDateInRange(row.event_date, dateRange, endIso, customStart, customEnd))
    .map((row) => {
      const kwh = toNumber(row.total_energy_kwh);
      return {
        date: row.event_date,
        total: unit === "kWh" ? kwh : kwh / KWH_PER_PERCENT,
      };
    });
}

function isDateInRange(
  iso: string,
  dateRange: string,
  endIso?: string,
  customStart?: Date,
  customEnd?: Date
) {
  if (dateRange === "all") return true;

  const day = atNoon(iso);
  if (dateRange === "custom" && customStart && customEnd) {
    const start = new Date(customStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(customEnd);
    end.setHours(23, 59, 59, 999);
    return day >= start && day <= end;
  }

  if (!endIso) return true;
  const daysBack = dateRange === "7d" ? 7 : dateRange === "14d" ? 14 : 30;
  const cutoff = atNoon(endIso);
  cutoff.setDate(cutoff.getDate() - daysBack);
  return day >= cutoff;
}

type DailyChargeRow = {
  date: string;
  total: number;
  [vehicleId: string]: string | number;
};

function fillMissingDailyRows(
  rows: DailyChargeRow[],
  vehicleIds: string[],
  dateRange: string,
  customStart?: Date,
  customEnd?: Date
) {
  if (rows.length === 0) return rows;

  const sortedRows = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const endIso = customEnd ? toIsoDate(customEnd) : sortedRows[sortedRows.length - 1].date;
  const startIso = getTimelineStartIso(sortedRows[0].date, endIso, dateRange, customStart);
  const byDate = new Map(sortedRows.map((row) => [row.date, row]));
  const filledRows: DailyChargeRow[] = [];

  for (const date of eachIsoDay(startIso, endIso)) {
    const source = byDate.get(date);
    const row: DailyChargeRow = { date, total: toNumber(source?.total) };

    vehicleIds.forEach((vehicleId) => {
      row[vehicleId] = toNumber(source?.[vehicleId] as number | undefined);
    });

    filledRows.push(row);
  }

  return filledRows;
}

function getTimelineStartIso(
  firstDataIso: string,
  endIso: string,
  dateRange: string,
  customStart?: Date
) {
  if (dateRange === "custom" && customStart) return toIsoDate(customStart);
  if (dateRange === "7d" || dateRange === "14d" || dateRange === "30d") {
    const daysBack = dateRange === "7d" ? 7 : dateRange === "14d" ? 14 : 30;
    const start = atNoon(endIso);
    start.setDate(start.getDate() - daysBack);
    return toIsoDate(start);
  }
  return firstDataIso;
}

function eachIsoDay(startIso: string, endIso: string) {
  const dates: string[] = [];
  const cursor = atNoon(startIso);
  const end = atNoon(endIso);

  while (cursor <= end) {
    dates.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
