import { useNavigate } from "react-router-dom";
import { BarChart3, Menu, LogOut, Users } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import elonroadLogo from "@/assets/elonroad-logo.png";

interface ElonroadHeaderProps {
  periodLabel?: string;
}

export const ElonroadHeader = ({ periodLabel = "No database sessions" }: ElonroadHeaderProps) => {
  const { t, language } = useLanguage();
  const { signOut, user, isAdmin } = useAuth();
  const navigate = useNavigate();
  
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title - always visible */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <img 
                src={elonroadLogo} 
                alt="Elonroad" 
                className="h-6 sm:h-8 w-auto"
              />
              <span className="text-lg sm:text-xl font-bold text-foreground">Elonroad</span>
            </div>
            <span className="hidden sm:inline text-muted-foreground">|</span>
            <div className="hidden sm:flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="w-4 h-4" />
              <span className="text-sm font-medium">{t("header.dataAnalysis")}</span>
            </div>
          </div>
          
          {/* Desktop: Full info */}
          <div className="hidden md:flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{t("header.period")}</span>{" "}
 {periodLabel}
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{t("header.author")}</span>{" "}
              Sebastian M
            </div>
            <div className="h-6 w-px bg-border" />
            <LanguageToggle />
            <div className="h-6 w-px bg-border" />
            <ThemeToggle />
            <div className="h-6 w-px bg-border" />
            {isAdmin && (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="gap-1.5 text-muted-foreground hover:text-foreground">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">{t("admin.manageUsers")}</span>
                </Button>
                <div className="h-6 w-px bg-border" />
              </>
            )}
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4" />
              <span className="text-sm">{t("header.signOut")}</span>
            </Button>
          </div>

          {/* Mobile/Tablet: Theme toggle + Language toggle + Menu */}
          <div className="flex md:hidden items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px]">
                <div className="flex flex-col gap-6 pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <BarChart3 className="w-4 h-4" />
                    <span className="text-sm font-medium">{t("header.dataAnalysis")}</span>
                  </div>
                  <div className="space-y-4">
                    <div className="text-sm">
                      <span className="font-medium text-foreground">{t("header.period")}</span>
                      <span className="text-muted-foreground ml-2">{periodLabel}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-foreground">{t("header.author")}</span>
                      <span className="text-muted-foreground ml-2">Sebastian M</span>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};
