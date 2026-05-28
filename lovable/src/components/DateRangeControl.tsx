import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface DateRangeControlProps {
  selectedRange: string;
  onRangeChange: (range: string) => void;
  customStart?: Date;
  customEnd?: Date;
  onCustomDateChange?: (start: Date | undefined, end: Date | undefined) => void;
  minDate?: Date;
  maxDate?: Date;
}

export const DateRangeControl = ({
  selectedRange,
  onRangeChange,
  customStart,
  customEnd,
  onCustomDateChange,
  minDate,
  maxDate,
}: DateRangeControlProps) => {
  const { t, language } = useLanguage();
  const today = new Date();
  const dataStart = minDate ?? today;
  const dataEnd = maxDate ?? today;

  const ranges = [
    { id: "7d", labelKey: "dateRange.7days", shortKey: "dateRange.7d" },
    { id: "14d", labelKey: "dateRange.14days", shortKey: "dateRange.14d" },
    { id: "30d", labelKey: "dateRange.30days", shortKey: "dateRange.30d" },
    { id: "all", labelKey: "dateRange.allData", shortKey: "dateRange.all" },
  ];

  const handleCustomSelect = () => {
    onRangeChange("custom");
  };

  return (
    <div className="control-panel animate-slide-up">
      <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3 sm:mb-4 text-sm sm:text-base">
        <CalendarIcon className="w-4 h-4" />
        {language === "en" ? "Time Period" : "Tidsperiod"}
      </h3>

      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {ranges.map((range) => (
          <Button
            key={range.id}
            variant={selectedRange === range.id ? "default" : "outline"}
            size="sm"
            onClick={() => onRangeChange(range.id)}
            className={cn(
              "transition-all text-xs sm:text-sm px-2 sm:px-3 h-8 sm:h-9",
              selectedRange === range.id && "shadow-sm"
            )}
          >
            <span className="hidden xs:inline">{t(range.labelKey)}</span>
            <span className="xs:hidden">{t(range.shortKey)}</span>
          </Button>
        ))}

        <Button
          variant={selectedRange === "custom" ? "default" : "outline"}
          size="sm"
          onClick={handleCustomSelect}
          className={cn(
            "transition-all text-xs sm:text-sm px-2 sm:px-3 h-8 sm:h-9",
            selectedRange === "custom" && "shadow-sm"
          )}
        >
          {language === "en" ? "Custom" : "Anpassad"}
        </Button>
      </div>

      {selectedRange === "custom" && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-[140px] justify-start text-left font-normal text-xs sm:text-sm h-8 sm:h-9",
                  !customStart && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {customStart ? format(customStart, "yyyy-MM-dd") : (language === "en" ? "Start date" : "Startdatum")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customStart}
                onSelect={(date) => onCustomDateChange?.(date, customEnd)}
                disabled={(date) => date < dataStart || date > dataEnd || (customEnd ? date > customEnd : false)}
                defaultMonth={customStart || dataStart}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <span className="text-muted-foreground text-xs">—</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-[140px] justify-start text-left font-normal text-xs sm:text-sm h-8 sm:h-9",
                  !customEnd && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {customEnd ? format(customEnd, "yyyy-MM-dd") : (language === "en" ? "End date" : "Slutdatum")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customEnd}
                onSelect={(date) => onCustomDateChange?.(customStart, date)}
                disabled={(date) => date < dataStart || date > dataEnd || (customStart ? date < customStart : false)}
                defaultMonth={customEnd || dataEnd}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
};
