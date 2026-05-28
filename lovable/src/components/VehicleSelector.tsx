import type { VehicleStats } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { BatteryCharging, Check, Truck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface VehicleSelectorProps {
  selectedVehicles: string[];
  onSelectionChange: (vehicles: string[]) => void;
  vehicles?: VehicleStats[];
  chargingVehicleIds?: string[];
}

export const VehicleSelector = ({
  selectedVehicles,
  onSelectionChange,
  vehicles = [],
  chargingVehicleIds = [],
}: VehicleSelectorProps) => {
  const { t, language } = useLanguage();
  const chargingVehicleSet = new Set(chargingVehicleIds);

  const toggleVehicle = (vehicleId: string) => {
    if (selectedVehicles.includes(vehicleId)) {
      onSelectionChange(selectedVehicles.filter((id) => id !== vehicleId));
    } else {
      onSelectionChange([...selectedVehicles, vehicleId]);
    }
  };

  const selectAll = () => {
    onSelectionChange(Array.from(new Set(vehicles.map((v) => v.id))));
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="control-panel animate-slide-up">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm sm:text-base">
          <Truck className="w-4 h-4" />
          <span className="hidden xs:inline">{t("vehicleSelector.selectVehicles")}</span>
          <span className="xs:hidden">{language === "en" ? "Filter" : "Filter"}</span>
        </h3>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="text-xs text-primary hover:underline font-medium"
          >
            {t("vehicleSelector.allVehicles")}
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-foreground font-medium"
          >
            {language === "en" ? "Clear" : "Rensa"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        {vehicles.map((vehicle) => {
          const isSelected = selectedVehicles.includes(vehicle.id);
          const isCharging = chargingVehicleSet.has(vehicle.id);
          return (
            <button
              key={vehicle.id}
              onClick={() => toggleVehicle(vehicle.id)}
              className={cn(
                "flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border transition-all duration-200 text-left",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-secondary/50"
              )}
            >
              <div
                className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full shrink-0"
                style={{ backgroundColor: vehicle.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                  {vehicle.name.replace(" Vehicle", "")}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  {vehicle.totalSessions} {language === "en" ? "sessions" : "sessioner"}
                </p>
              </div>
              {isCharging && (
                <span
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 ring-1 ring-emerald-500/25"
                  title={language === "en" ? "Charging now" : "Laddar nu"}
                >
                  <BatteryCharging className="h-3.5 w-3.5" />
                </span>
              )}
              {isSelected && (
                <Check className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-primary shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 sm:mt-3 text-center">
        {selectedVehicles.length === 0
          ? (language === "en" ? "Select vehicles to filter data" : "Välj fordon för att filtrera data")
          : (language === "en" 
              ? `${selectedVehicles.length} of ${vehicles.length} vehicles selected`
              : `${selectedVehicles.length} av ${vehicles.length} fordon valda`)}
      </p>
    </div>
  );
};
