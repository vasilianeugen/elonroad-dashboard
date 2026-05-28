import type { ChargerStats } from "@/types/dashboard";
import { ArrowUpDown, TrendingUp, TrendingDown, Zap } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

type SortField = "name" | "totalCharge" | "avgChargingSpeed" | "totalSessions" | "avgSessionLength";
type SortDirection = "asc" | "desc";

interface ChargerTableProps {
  chargers?: ChargerStats[];
  speedUnit?: string;
}

export const ChargerTable = ({ chargers = [], speedUnit = "%SoC/min" }: ChargerTableProps) => {
  const { language } = useLanguage();
  const [sortField, setSortField] = useState<SortField>("avgChargingSpeed");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedData = [...chargers].sort((a, b) => {
    const multiplier = sortDirection === "asc" ? 1 : -1;
    if (sortField === "name") {
      return a.name.localeCompare(b.name) * multiplier;
    }
    return (a[sortField] - b[sortField]) * multiplier;
  });

  const maxSpeed = chargers.length > 0 ? Math.max(...chargers.map((c) => c.avgChargingSpeed)) : 0;
  const minSpeed = chargers.length > 0 ? Math.min(...chargers.map((c) => c.avgChargingSpeed)) : 0;

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
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-primary" />
          <h3 className="text-lg sm:text-2xl font-bold text-foreground">
            {language === "en" ? "Charger Performance" : "Laddarprestanda"}
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {language === "en" ? "Charging speed and usage by charger (click headers to sort)" : "Laddningshastighet och användning per laddare (klicka på rubrik för att sortera)"}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table text-xs sm:text-sm table-fixed w-full">
          <thead>
            <tr className="bg-secondary/30">
              <SortHeader field="name" label={language === "en" ? "Charger" : "Laddare"} className="w-[26%]" />
              <SortHeader field="totalCharge" label={language === "en" ? "Energy" : "Energi"} shortLabel={language === "en" ? "Energy" : "Energi"} className="w-[20%]" />
              <SortHeader field="avgChargingSpeed" label={language === "en" ? "Avg Speed" : "Snitt Hastighet"} shortLabel={language === "en" ? "Speed" : "Hastighet"} className="w-[26%]" />
              <SortHeader field="avgSessionLength" label={language === "en" ? "Avg Length" : "Snitt Längd"} shortLabel={language === "en" ? "Length" : "Längd"} className="w-[16%]" />
              <SortHeader field="totalSessions" label="Sess." shortLabel="Sess." className="w-[12%]" />
            </tr>
          </thead>
          <tbody>
            {sortedData.map((charger) => (
              <tr key={charger.id}>
                <td>
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div
                      className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full shrink-0"
                      style={{ backgroundColor: charger.color }}
                    />
                    <span className="font-medium truncate" title={charger.name.replace(" Power Rail", "")}>
                      {charger.name.replace(" Power Rail", "")}
                    </span>
                  </div>
                </td>
                <td>
                  <span className="font-semibold tabular-nums whitespace-nowrap">
                    {charger.totalCharge.toFixed(3)}
                    <span className="ml-1 text-[10px] sm:text-xs font-medium text-muted-foreground">kWh</span>
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <span className={cn(
                      "font-semibold tabular-nums whitespace-nowrap",
                      charger.avgChargingSpeed > 0.7 && "text-primary"
                    )}>
                      {charger.avgChargingSpeed.toFixed(3)}
                      <span className="ml-1 text-[10px] sm:text-xs font-medium text-muted-foreground">{speedUnit}</span>
                    </span>
                    {charger.avgChargingSpeed === maxSpeed && (
                      <TrendingUp className="w-3 sm:w-4 h-3 sm:h-4 text-success" />
                    )}
                    {charger.avgChargingSpeed === minSpeed && (
                      <TrendingDown className="w-3 sm:w-4 h-3 sm:h-4 text-muted-foreground" />
                    )}
                  </div>
                </td>
                <td>
                  <span className="tabular-nums whitespace-nowrap">
                    {charger.avgSessionLength.toFixed(1)}
                    <span className="ml-1 text-[10px] sm:text-xs font-medium text-muted-foreground">min</span>
                  </span>
                </td>
                <td>
                  <span className="font-medium tabular-nums">{charger.totalSessions}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
