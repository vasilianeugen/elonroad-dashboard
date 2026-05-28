import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, X } from "lucide-react";

const passwordCriteria = [
  { key: "minLength", test: (p: string) => p.length >= 8 },
  { key: "uppercase", test: (p: string) => /[A-Z]/.test(p) },
  { key: "lowercase", test: (p: string) => /[a-z]/.test(p) },
  { key: "number", test: (p: string) => /\d/.test(p) },
  { key: "special", test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

export const ForcePasswordChange = () => {
  const { mustChangePassword, clearMustChangePassword } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const allCriteriaMet = passwordCriteria.every((c) => c.test(password));
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allCriteriaMet || !passwordsMatch) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password,
    });
    if (error) {
      toast({ title: t("admin.error"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("forcePassword.success") });
      clearMustChangePassword();
    }
    setLoading(false);
  };

  if (!mustChangePassword) return null;

  return (
    <Dialog open={mustChangePassword}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t("forcePassword.title")}</DialogTitle>
          <DialogDescription>{t("forcePassword.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("admin.newPassword")}</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5 text-sm">
            {passwordCriteria.map((c) => {
              const met = c.test(password);
              return (
                <div key={c.key} className="flex items-center gap-2">
                  {met ? (
                    <Check className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span className={met ? "text-foreground" : "text-muted-foreground"}>
                    {t(`reset.criteria.${c.key}`)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <Label>{t("reset.confirmPassword")}</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {confirmPassword && !passwordsMatch && (
              <p className="text-sm text-destructive">{t("reset.passwordsMismatch")}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading || !allCriteriaMet || !passwordsMatch}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("reset.updatePassword")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
