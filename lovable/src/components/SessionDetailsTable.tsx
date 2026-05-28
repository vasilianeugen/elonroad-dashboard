import type { ChargerStats, ChargingSession, VehicleStats } from "@/types/dashboard";
import { ArrowUpDown, Clock, Zap, Battery, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { sortSessions, type SessionSortField, type SessionSortDirection } from "@/utils/sortSessions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SessionDetailsTableProps {
  selectedVehicles: string[];
  selectedChargers: string[];
  sessions?: ChargingSession[];
  vehicles?: VehicleStats[];
  chargers?: ChargerStats[];
}

type SortField = SessionSortField;

// Source times are in UTC. Convert to Long Beach, CA local time (America/Los_Angeles).
// If addDays > 0, the timestamp is shifted forward (used when a session crosses midnight UTC).
const convertUtcToLA = (dateStr: string, timeStr: string, addDays = 0): string => {
  if (!timeStr) return timeStr;
  const [h, m, s] = timeStr.split(":").map(Number);
  if (isNaN(h)) return timeStr;
  const d = new Date(`${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s ?? 0).padStart(2, "0")}Z`);
  if (isNaN(d.getTime())) return timeStr;
  if (addDays) d.setUTCDate(d.getUTCDate() + addDays);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
};

// If endTime is earlier than startTime in UTC, the session crossed midnight UTC,
// so the end timestamp belongs to the next day. This keeps the LA times chronological.
const endDayOffset = (startTime: string, endTime: string): number => {
  if (!startTime || !endTime) return 0;
  return endTime < startTime ? 1 : 0;
};

const formatPercent = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  const rounded = Number(value.toFixed(1));
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
};

type SortDirection = SessionSortDirection;
export const SessionDetailsTable = ({
  selectedVehicles,
  selectedChargers,
  sessions = [],
  vehicles = [],
  chargers = [],
}: SessionDetailsTableProps) => {
  const { language } = useLanguage();
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    setCurrentPage(1);
  };

  // Get vehicle and charger names
  const getVehicleName = (vehicleId: string) => {
    return vehicles.find((v) => v.id === vehicleId)?.name || vehicleId;
  };

  const getVehicleColor = (vehicleId: string) => {
    return vehicles.find((v) => v.id === vehicleId)?.color || "hsl(220 15% 50%)";
  };

  const getChargerName = (chargerId: string) => {
    return chargers.find((c) => c.id === chargerId)?.name || chargerId;
  };

  const getChargerColor = (chargerId: string) => {
    return chargers.find((c) => c.id === chargerId)?.color || "hsl(220 15% 50%)";
  };

  // Filter and sort sessions
  const filteredData = sortSessions(
    sessions
      .filter((s) => selectedVehicles.length === 0 || selectedVehicles.includes(s.vehicleId))
      .filter((s) => selectedChargers.length === 0 || selectedChargers.includes(s.chargerId)),
    { sortField, sortDirection, getVehicleName, getChargerName }
  );

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Summary stats (for all filtered data, not just current page)
  const totalKwh = filteredData.reduce((sum, s) => sum + s.chargeAdded * 2.36, 0);
  const avgKwh = filteredData.length > 0 ? totalKwh / filteredData.length : 0;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString(language === "en" ? "en-GB" : "sv-SE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const SortHeader = ({ field, label, className }: { field: SortField; label: string; className?: string }) => (
    <TableHead
      className={cn("cursor-pointer hover:bg-secondary/50 transition-colors whitespace-nowrap", className)}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        <ArrowUpDown className={cn(
          "w-3 h-3 transition-colors shrink-0",
          sortField === field ? "text-primary" : "text-muted-foreground"
        )} />
      </div>
    </TableHead>
  );

  return (
    <div className="elonroad-card overflow-hidden animate-slide-up">
      <div className="p-4 sm:p-6 border-b border-border">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-primary/10">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-lg sm:text-2xl font-bold text-foreground">
            {language === "en" ? "Charging Session Details" : "Laddningssessionsdetaljer"}
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground ml-12">
          {language === "en" 
            ? `${filteredData.length} sessions • Click headers to sort` 
            : `${filteredData.length} sessioner • Klicka på rubriker för att sortera`}
        </p>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden divide-y divide-border">
        {paginatedData.map((session) => {
          const startLA = convertUtcToLA(session.date, session.startTime);
          const endLA = convertUtcToLA(session.date, session.endTime, endDayOffset(session.startTime, session.endTime));
          return (
            <div key={session.id} className="p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{formatDate(session.date)}</span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{session.duration.toFixed(0)} min</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getVehicleColor(session.vehicleId) }} />
                  <span className="font-medium">{getVehicleName(session.vehicleId)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getChargerColor(session.chargerId) }} />
                  <span className="text-muted-foreground">{getChargerName(session.chargerId)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span>{startLA}</span>
                <span className="text-muted-foreground/60">→</span>
                <span>{endLA}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">LA</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs">
                  <Battery className="w-3 h-3" />
                  {formatPercent(session.startSoC)}%
                </span>
                <span className="text-muted-foreground text-xs">→</span>
                <span className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
                  session.endSoC >= 95 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted"
                )}>
                  <Battery className="w-3 h-3" />
                  {formatPercent(session.endSoC)}%
                </span>
                <span className="ml-auto font-semibold text-primary text-sm">
                  +{formatPercent(session.chargeAdded)}% · {(session.chargeAdded * 2.36).toFixed(1)} kWh
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop / tablet table */}
      <div className="hidden sm:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/30">
              <SortHeader field="date" label={language === "en" ? "Date" : "Datum"} />
              <SortHeader field="vehicle" label={language === "en" ? "Vehicle" : "Fordon"} />
              <SortHeader field="charger" label={language === "en" ? "Charger" : "Laddare"} />
              <TableHead className="whitespace-nowrap">
                {language === "en" ? "Start Time" : "Starttid"}
              </TableHead>
              <TableHead className="whitespace-nowrap">
                {language === "en" ? "End Time" : "Sluttid"}
              </TableHead>
              <TableHead className="whitespace-nowrap text-center">
                {language === "en" ? "Start SoC" : "Start SoC"}
              </TableHead>
              <TableHead className="whitespace-nowrap text-center">
                {language === "en" ? "End SoC" : "Slut SoC"}
              </TableHead>
              <SortHeader field="chargeAdded" label={language === "en" ? "Charge Added" : "Laddning"} />
              <SortHeader field="kwhCharged" label={language === "en" ? "kWh Charged" : "kWh Laddad"} />
              <SortHeader field="duration" label={language === "en" ? "Duration" : "Längd"} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((session) => (
              <TableRow key={session.id} className="hover:bg-muted/50">
                <TableCell className="font-medium whitespace-nowrap">
                  {formatDate(session.date)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: getVehicleColor(session.vehicleId) }}
                    />
                    <span className="whitespace-nowrap">{getVehicleName(session.vehicleId)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: getChargerColor(session.chargerId) }}
                    />
                    <span className="whitespace-nowrap text-sm">{getChargerName(session.chargerId)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap font-mono text-sm">
                  {convertUtcToLA(session.date, session.startTime)}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap font-mono text-sm">
                  {convertUtcToLA(session.date, session.endTime, endDayOffset(session.startTime, session.endTime))}
                </TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-sm">
                    <Battery className="w-3 h-3" />
                    {formatPercent(session.startSoC)}%
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm",
                    session.endSoC >= 95 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted"
                  )}>
                    <Battery className="w-3 h-3" />
                    {formatPercent(session.endSoC)}%
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-semibold text-primary">+{formatPercent(session.chargeAdded)}%</span>
                </TableCell>
                <TableCell>
                  <span className="font-semibold text-primary">{(session.chargeAdded * 2.36).toFixed(1)} kWh</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{session.duration.toFixed(0)} min</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Summary Footer */}
      {filteredData.length > 0 && (
        <div className="px-4 sm:px-6 py-3 border-t border-border bg-secondary/20">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{language === "en" ? "Total Sessions" : "Totalt Antal Sessioner"}:</span>
              <span className="font-semibold text-foreground">{filteredData.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{language === "en" ? "Total kWh Charged" : "Totalt kWh Laddat"}:</span>
              <span className="font-semibold text-primary">{totalKwh.toFixed(1)} kWh</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{language === "en" ? "Avg kWh per Session" : "Snitt kWh per Session"}:</span>
              <span className="font-semibold text-primary">{avgKwh.toFixed(1)} kWh</span>
            </div>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-border">
          <p className="text-sm text-muted-foreground">
            {language === "en"
              ? `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredData.length)} of ${filteredData.length}`
              : `Visar ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredData.length)} av ${filteredData.length}`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {filteredData.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          {language === "en" ? "No sessions match the selected filters" : "Inga sessioner matchar valda filter"}
        </div>
      )}
    </div>
  );
};
