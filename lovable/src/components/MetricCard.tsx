import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  highlight?: boolean;
  className?: string;
}

export const MetricCard = ({
  title,
  value,
  unit,
  subtitle,
  icon: Icon,
  trend,
  highlight,
  className,
}: MetricCardProps) => {
  return (
    <div
      className={cn(
        "metric-card animate-slide-up p-4 sm:p-6",
        highlight && "border-primary/40 bg-primary/5",
        className
      )}
    >
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className={cn(
          "p-2 sm:p-2.5 rounded-lg",
          highlight ? "bg-primary/15" : "bg-secondary"
        )}>
          <Icon className={cn(
            "w-4 sm:w-5 h-4 sm:h-5",
            highlight ? "text-primary" : "text-muted-foreground"
          )} />
        </div>
        {trend && (
          <div className="text-right">
            <span className={cn(
              "text-xs font-medium",
              trend.value >= 0 ? "text-success" : "text-destructive"
            )}>
              {trend.value >= 0 ? "+" : ""}{trend.value}%
            </span>
            <p className="text-xs text-muted-foreground">{trend.label}</p>
          </div>
        )}
      </div>
      
      <p className="text-xs sm:text-sm text-muted-foreground mb-1 line-clamp-2">{title}</p>
      <div className="flex items-baseline gap-0.5 sm:gap-1">
        <span className={cn(
          "text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight",
          highlight ? "text-primary" : "text-foreground"
        )}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {unit && <span className="text-sm sm:text-base lg:text-lg text-muted-foreground">{unit}</span>}
      </div>
      {subtitle && (
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5 sm:mt-2">{subtitle}</p>
      )}
    </div>
  );
};
