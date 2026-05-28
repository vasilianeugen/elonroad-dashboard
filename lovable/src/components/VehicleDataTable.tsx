import type { VehicleStats } from "@/types/dashboard";
import { ArrowUpDown, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface VehicleDataTableProps {
  selectedVehicles: string[];
  vehicles?: VehicleStats[];
  valueUnit?: string;
  speedUnit?: string;
}

type SortField = "name" | "totalCharge" | "avgChargingSpeed" | "avgSessionTime" | "totalSessions";
type SortDirection = "asc" | "desc";

export const VehicleDataTable = ({
  selectedVehicles,
  vehicles = [],
  valueUnit = "%SoC",
  speedUnit = "%SoC/min",
}: VehicleDataTableProps) => {
  const { language } = useLanguage();
  const [sortField, setSortField] = useState<SortField>("totalCharge");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const filteredData = vehicles
    .filter((v) => selectedVehicles.length === 0 || selectedVehicles.includes(v.id))
    .sort((a, b) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;
      if (sortField === "name") {
        return a.name.localeCompare(b.name) * multiplier;
      }
      return (a[sortField] - b[sortField]) * multiplier;
    });

  const maxCharge = filteredData.length > 0 ? Math.max(...filteredData.map((v) => v.totalCharge)) : 0;
  const minCharge = filteredData.length > 0 ? Math.min(...filteredData.map((v) => v.totalCharge)) : 0;

  const SortHeader = ({ field, label, shortLabel, className }: { field: SortField; label: string; shortLabel?: string; className?: string }) => (
    <th
      className={cn("cursor-pointer hover:bg-secondary/50 transition-colors align-middle", className)}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
        <span className="hidden sm:inline whitespace-pre-line leading-tight max-w-[8rem]">{label}</span>
        <span className="sm:hidden whitespace-normal leading-tight max-w-[5.5rem]">{shortLabel || label}</span>
        <ArrowUpDown className={cn(
          "w-3 h-3 transition-colors shrink-0",
          sortField === field ? "text-primary" : "text-muted-foreground"
        )} />
      </div>
    </th>
  );

  return (
    <div className="elonroad-card overflow-hidden animate-slide-up">
      <div className="p-4 sm:p-6 border-b border-border">
        <h3 className="text-lg sm:text-2xl font-bold text-foreground mb-1">
          {language === "en" ? "Vehicle Summary Statistics" : "Sammanfattande Statistik per Fordon"}
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {language === "en" ? "Summary statistics for each vehicle (click headers to sort)" : "Sammanfattande statistik per fordon (klicka på rubrik för att sortera)"}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table text-xs sm:text-sm table-fixed w-full">
          <thead>
            <tr className="bg-secondary/30">
              <SortHeader field="name" label={language === "en" ? "Vehicle" : "Fordon"} className="w-[26%]" />
              <SortHeader field="totalCharge" label={language === "en" ? "Total Charge" : "Total Laddning"} shortLabel={language === "en" ? "Charge" : "Laddning"} className="w-[21%]" />
              <SortHeader field="avgChargingSpeed" label={language === "en" ? "Avg Speed" : "Snitt Hastighet"} shortLabel={language === "en" ? "Speed" : "Hastighet"} className="w-[26%]" />
              <SortHeader field="avgSessionTime" label={language === "en" ? "Avg Time" : "Snitt Tid"} shortLabel={language === "en" ? "Time" : "Tid"} className="w-[15%]" />
              <SortHeader field="totalSessions" label="Sess." shortLabel="Sess." className="w-[12%]" />
            </tr>
          </thead>
          <tbody>
            {filteredData.map((vehicle) => (
              <tr key={vehicle.id}>
                <td>
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div
                      className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full shrink-0"
                      style={{ backgroundColor: vehicle.color }}
                    />
                    <span className="font-medium truncate" title={vehicle.name}>
                      {vehicle.name}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <span className="font-semibold tabular-nums whitespace-nowrap">
                      {vehicle.totalCharge.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      <span className="ml-1 text-[10px] sm:text-xs font-medium text-muted-foreground">{valueUnit}</span>
                    </span>
                    {vehicle.totalCharge === maxCharge && (
                      <TrendingUp className="w-3 sm:w-4 h-3 sm:h-4 text-success" />
                    )}
                    {vehicle.totalCharge === minCharge && (
                      <TrendingDown className="w-3 sm:w-4 h-3 sm:h-4 text-muted-foreground" />
                    )}
                  </div>
                </td>
                <td>
                  <span className={cn(
                    "font-medium tabular-nums whitespace-nowrap",
                    vehicle.avgChargingSpeed > 0.7 && "text-primary"
                  )}>
                    {vehicle.avgChargingSpeed.toFixed(3)}
                    <span className="ml-1 text-[10px] sm:text-xs font-medium text-muted-foreground">{speedUnit}</span>
                  </span>
                </td>
                <td>
                  <span className="tabular-nums whitespace-nowrap">
                    {vehicle.avgSessionTime.toFixed(0)}
                    <span className="ml-1 text-[10px] sm:text-xs font-medium text-muted-foreground">min</span>
                  </span>
                </td>
                <td>
                  <span className="font-medium tabular-nums">{vehicle.totalSessions}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
