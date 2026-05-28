import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ChargingSession, VehicleStats } from "@/types/dashboard";
import { filterSessionsByDateRange, KWH_PER_PERCENT } from "@/lib/dashboardData";
import { useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface EnergyBarChartProps {
  selectedVehicles: string[];
  dateRange: string;
  customStart?: Date;
  customEnd?: Date;
  vehicles?: VehicleStats[];
  sessions?: ChargingSession[];
  unit?: string;
}

const CustomTooltip = ({ active, payload, label, unit = "%SoC" }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-foreground mb-1">{label}</p>
        <p className="text-primary font-bold text-lg">
          {payload[0].value.toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}
        </p>
      </div>
    );
  }
  return null;
};

export const EnergyBarChart = ({
  selectedVehicles,
  dateRange,
  customStart,
  customEnd,
  vehicles = [],
  sessions = [],
  unit = "%SoC",
}: EnergyBarChartProps) => {
  const { language } = useLanguage();

  // Calculate charge per vehicle based on date range
  const chartData = useMemo(() => {
    if (sessions.length === 0) {
      return vehicles
        .filter((v) => selectedVehicles.length === 0 || selectedVehicles.includes(v.id))
        .map((v) => ({
          ...v,
          shortName: v.name,
          totalCharge: v.totalCharge,
        }));
    }

    const filteredSessions = filterSessionsByDateRange(sessions, dateRange, customStart, customEnd);
    
    const chargeByVehicle = vehicles
      .filter((v) => selectedVehicles.length === 0 || selectedVehicles.includes(v.id))
      .map((vehicle) => {
        const vehicleSessions = filteredSessions.filter(
          (s) => s.vehicleId === vehicle.id
        );
        const totalCharge =
          vehicleSessions.reduce((sum, s) => sum + s.chargeAdded, 0) *
          (unit === "kWh" ? KWH_PER_PERCENT : 1);
        
        return {
          ...vehicle,
          totalCharge,
          shortName: vehicle.name,
        };
      });

    return chargeByVehicle;
  }, [vehicles, sessions, selectedVehicles, dateRange, customStart, customEnd, unit]);

  const getDaysLabel = () => {
    if (dateRange === "7d") return "7";
    if (dateRange === "14d") return "14";
    return "30";
  };

  return (
    <div className="elonroad-card p-6 animate-slide-up">
      <div className="mb-6">
        <h3 className="section-header">
          {language === "en" ? "Total Charge Added per Vehicle" : "Total Tillförd Laddning per Fordon"}
        </h3>
        <p className="section-subheader">
          {language === "en" ? `Total charge added in ${unit}` : `Total tillförd laddning i ${unit}`}
          {dateRange !== "all" && dateRange !== "custom" && (
            <span className="text-primary ml-1">
              — {language === "en" ? `Last ${getDaysLabel()} days` : `Senaste ${getDaysLabel()} dagarna`}
            </span>
          )}
          {dateRange === "custom" && customStart && customEnd && (
            <span className="text-primary ml-1">
              — {customStart.toLocaleDateString()} – {customEnd.toLocaleDateString()}
            </span>
          )}
        </p>
      </div>

      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            barCategoryGap="20%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(220 15% 88%)"
              vertical={false}
            />
            <XAxis
              dataKey="shortName"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(220 15% 45%)", fontSize: 12 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(220 15% 45%)", fontSize: 12 }}
              tickFormatter={(value) => `${value}`}
            />
            <Tooltip content={<CustomTooltip unit={unit} />} cursor={{ fill: "hsl(220 15% 88% / 0.3)" }} />
            <Bar
              dataKey="totalCharge"
              radius={[6, 6, 0, 0]}
              maxBarSize={80}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap justify-center gap-4 mt-4 pt-4 border-t border-border">
        {chartData.map((vehicle) => (
          <div key={vehicle.id} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: vehicle.color }}
            />
            <span className="text-sm text-muted-foreground">{vehicle.shortName}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
