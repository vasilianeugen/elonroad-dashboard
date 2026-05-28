import { useLanguage } from "@/contexts/LanguageContext";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const LanguageToggle = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <ToggleGroup
      type="single"
      value={language}
      onValueChange={(value) => {
        if (value === "en" || value === "sv") {
          setLanguage(value);
        }
      }}
      className="border border-border rounded-md"
    >
      <ToggleGroupItem
        value="en"
        aria-label="English"
        className="px-2 py-1 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        EN
      </ToggleGroupItem>
      <ToggleGroupItem
        value="sv"
        aria-label="Svenska"
        className="px-2 py-1 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        SV
      </ToggleGroupItem>
    </ToggleGroup>
  );
};
