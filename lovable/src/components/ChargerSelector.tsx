import type { ChargerStats } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { Check, Zap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ChargerSelectorProps {
  selectedChargers: string[];
  onSelectionChange: (chargers: string[]) => void;
  chargers?: ChargerStats[];
}

export const ChargerSelector = ({
  selectedChargers,
  onSelectionChange,
  chargers = [],
}: ChargerSelectorProps) => {
  const { language } = useLanguage();

  const toggleCharger = (chargerId: string) => {
    if (selectedChargers.includes(chargerId)) {
      onSelectionChange(selectedChargers.filter((id) => id !== chargerId));
    } else {
      onSelectionChange([...selectedChargers, chargerId]);
    }
  };

  const selectAll = () => {
    onSelectionChange(Array.from(new Set(chargers.map((c) => c.id))));
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="control-panel animate-slide-up">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm sm:text-base">
          <Zap className="w-4 h-4" />
          <span className="hidden xs:inline">
            {language === "en" ? "Select Charging Stations" : "Välj Laddstationer"}
          </span>
          <span className="xs:hidden">
            {language === "en" ? "Chargers" : "Laddare"}
          </span>
        </h3>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="text-xs text-primary hover:underline font-medium"
          >
            {language === "en" ? "All Chargers" : "Alla Laddare"}
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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
        {chargers.map((charger) => {
          const isSelected = selectedChargers.includes(charger.id);
          return (
            <button
              key={charger.id}
              onClick={() => toggleCharger(charger.id)}
              className={cn(
                "flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border transition-all duration-200 text-left",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-secondary/50"
              )}
            >
              <div
                className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full shrink-0"
                style={{ backgroundColor: charger.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                  {charger.name.replace(" Power Rail", "")}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  {charger.totalSessions} {language === "en" ? "sessions" : "sessioner"}
                </p>
              </div>
              {isSelected && (
                <Check className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-primary shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 sm:mt-3 text-center">
        {selectedChargers.length === 0
          ? (language === "en" ? "Select chargers to filter data" : "Välj laddare för att filtrera data")
          : (language === "en" 
              ? `${selectedChargers.length} of ${chargers.length} chargers selected`
              : `${selectedChargers.length} av ${chargers.length} laddare valda`)}
      </p>
    </div>
  );
};
