import { Download, FileSpreadsheet, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";

interface ExportButtonProps {
  onExportSessions: () => void;
  onExportSummary: () => void;
  onExportEnergy: () => void;
}

export const ExportButton = ({ onExportSessions, onExportSummary, onExportEnergy }: ExportButtonProps) => {
  const { t } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-1.5 sm:gap-2 border-border hover:bg-secondary text-xs sm:text-sm px-2.5 sm:px-4 h-8 sm:h-9"
        >
          <Download className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
          <span className="hidden xs:inline">{t("export.exportData")}</span>
          <span className="xs:hidden">{t("export.export")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={onExportSessions} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          {t("export.exportSessions")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportSummary} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          {t("export.exportSummary")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onExportEnergy} className="gap-2 cursor-pointer">
          <Zap className="w-4 h-4 text-primary" />
          {t("export.exportEnergy")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
