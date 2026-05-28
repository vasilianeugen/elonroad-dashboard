import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { TrendingUp, Calendar } from "lucide-react";
import type { ChargingSession, VehicleStats } from "@/types/dashboard";
import type { DailyEnergyAggregate } from "@/lib/energyApi";
import { getDailyChargeData, KWH_PER_PERCENT, toNumber } from "@/lib/dashboardData";
import { useLanguage } from "@/contexts/LanguageContext";

interface DailyTrendChartProps {
  selectedVehicles: string[];
  dateRange: string;
  customStart?: Date;
  customEnd?: Date;
  sessions?: ChargingSession[];
  vehicles?: VehicleStats[];
  dailyAggregates?: DailyEnergyAggregate[];
  unit?: "kWh" | "%SoC";
}

export const DailyTrendChart = ({
  selectedVehicles,
  dateRange,
  customStart,
  customEnd,
  sessions = [],
  vehicles = [],
  dailyAggregates = [],
  unit = "%SoC",
}: DailyTrendChartProps) => {
  const { language } = useLanguage();

  const allData = useMemo(() => {
    const aggregateRows = getAggregateDailyData(dailyAggregates, dateRange, customStart, customEnd, unit);
    if (aggregateRows.length > 0) return aggregateRows;
    return getDailyChargeData(sessions, selectedVehicles, dateRange, customStart, customEnd, unit);
  }, [dailyAggregates, sessions, selectedVehicles, dateRange, customStart, customEnd, unit]);

  const [sliderRange, setSliderRange] = useState<[number, number]>([0, 100]);

  const data = useMemo(() => {
    if (allData.length === 0) return [];
    const startIndex = Math.floor((sliderRange[0] / 100) * allData.length);
    const endIndex = Math.ceil((sliderRange[1] / 100) * allData.length);
    return allData.slice(startIndex, Math.max(endIndex, startIndex + 1));
  }, [allData, sliderRange]);

  // Paletă extinsă de culori (20 nuanțe)
  const colorPalette = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
    '#393b79', '#637939', '#8c6d31', '#843c39', '#7b4173', '#5254a3', '#9c9ede', '#6b6ecf', '#b5cf6b', '#cedb9c'
  ];

  // Atribuie automat o culoare unică fiecărui vehicul dacă nu are definită
  const vehiclesWithColor = vehicles.map((v, idx) => ({
    ...v,
    color: v.color || colorPalette[idx % colorPalette.length],
  }));

  const filteredVehicles = vehiclesWithColor.filter(
    (v) => selectedVehicles.length === 0 || selectedVehicles.includes(v.id)
  );
  const usingAggregateSeries = allData.some((row) => "aggregateTotal" in row);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString(language === "en" ? "en-US" : "sv-SE", { month: "short", day: "numeric" });
  };
  const formatCharge = (value: number) => {
    if (value === 0) return "0";
    if (Math.abs(value) < 1) return value.toFixed(3);
    return value.toFixed(0);
  };

  const getDateRangeLabel = () => {
    if (data.length === 0) return language === "en" ? "No data" : "Ingen data";
    if (data.length === 1) return formatDate(data[0].date);
    return `${formatDate(data[0].date)} – ${formatDate(data[data.length - 1].date)}`;
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          {language === "en" ? "Daily Charging Trend" : "Daglig Laddningstrend"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {usingAggregateSeries
            ? language === "en"
              ? `Charge added over time from database aggregates (${unit})`
              : `Tillförd laddning över tid från databasaggregat (${unit})`
            : language === "en"
              ? `Charge added over time by vehicle (${unit})`
              : `Tillförd laddning över tid per fordon (${unit})`}
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
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
                    return [`${value.toFixed(value > 0 && value < 1 ? 3 : 1)} ${unit}`, language === "en" ? "Database aggregate" : "Databasaggregat"];
                  }
                  const vehicle = vehiclesWithColor.find((v) => v.id === name);
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
                  const vehicle = vehiclesWithColor.find((v) => v.id === value);
                  return vehicle?.name || value;
                }}
              />
              {usingAggregateSeries ? (
                <Line
                  type="monotone"
                  dataKey="aggregateTotal"
                  name="aggregateTotal"
                  stroke="hsl(200 80% 50%)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "hsl(200 80% 50%)" }}
                  activeDot={{ r: 6, fill: "hsl(200 80% 50%)" }}
                  connectNulls
                />
              ) : filteredVehicles.map((vehicle) => (
                <Line
                  key={vehicle.id}
                  type="monotone"
                  dataKey={vehicle.id}
                  name={vehicle.id}
                  stroke={vehicle.color}
                  strokeWidth={2}
                  dot={{ r: 4, fill: vehicle.color }}
                  activeDot={{ r: 6, fill: vehicle.color }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Time Interval Slider */}
        <div className="mt-6 pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{language === "en" ? "Time Interval" : "Tidsintervall"}</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {getDateRangeLabel()}
            </span>
          </div>
          <Slider
            value={sliderRange}
            onValueChange={(value) => setSliderRange(value as [number, number])}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{allData.length > 0 ? formatDate(allData[0].date) : ""}</span>
            <span>{allData.length > 0 ? formatDate(allData[allData.length - 1].date) : ""}</span>
          </div>
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
        aggregateTotal: unit === "kWh" ? kwh : kwh / KWH_PER_PERCENT,
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
