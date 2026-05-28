import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import elonroadLogo from "@/assets/elonroad-logo.png";
import itsLogo from "@/assets/its-logo.png";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Loader2, LogIn, UserPlus, ArrowLeft, Check, X } from "lucide-react";

type View = "login" | "signup" | "forgot" | "reset";

const passwordCriteria = [
  { key: "minLength", test: (p: string) => p.length >= 8 },
  { key: "uppercase", test: (p: string) => /[A-Z]/.test(p) },
  { key: "lowercase", test: (p: string) => /[a-z]/.test(p) },
  { key: "number", test: (p: string) => /\d/.test(p) },
  { key: "special", test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

const Login = () => {
  const [searchParams] = useSearchParams();
  const isRecovery = searchParams.get("type") === "recovery";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>(isRecovery ? "reset" : "login");
  const { toast } = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Listen for PASSWORD_RECOVERY event to handle the reset flow
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setView("reset");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: t("login.error"), description: error.message, variant: "destructive" });
    } else {
      navigate("/");
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allCriteriaMet || !passwordsMatch) return;
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: "" },
      },
    });
    if (error) {
      toast({ title: t("login.error"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("signup.success"), description: t("signup.successDescription") });
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login?type=recovery`,
    });
    if (error) {
      toast({ title: t("login.error"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("reset.emailSent"), description: t("reset.emailSentDescription") });
    }
    setLoading(false);
  };

  const allCriteriaMet = passwordCriteria.every((c) => c.test(password));
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allCriteriaMet || !passwordsMatch) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: t("login.error"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("reset.success") });
      navigate("/");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <img src={elonroadLogo} alt="Elonroad" className="h-8 w-auto" />
              <span className="text-xl font-bold text-foreground">Elonroad</span>
              <span className="text-muted-foreground text-xl">|</span>
              <img src={itsLogo} alt="ITS" className="h-8 w-auto" />
            </div>
            <div>
              <CardTitle className="text-2xl">
                {view === "login" && t("login.title")}
                {view === "signup" && t("signup.title")}
                {view === "forgot" && t("reset.forgotTitle")}
                {view === "reset" && t("reset.newPasswordTitle")}
              </CardTitle>
              <CardDescription className="mt-1">
                {view === "login" && t("login.description")}
                {view === "signup" && t("signup.description")}
                {view === "forgot" && t("reset.forgotDescription")}
                {view === "reset" && t("reset.newPasswordDescription")}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {view === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("login.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@elonroad.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("login.password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      {t("login.submit")}
                    </>
                  )}
                </Button>
              </form>
            )}


            {view === "reset" && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">{t("login.password")}</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {/* Password criteria checklist */}
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
                  <Label htmlFor="confirm-password">{t("reset.confirmPassword")}</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  {confirmPassword && !passwordsMatch && (
                    <p className="text-sm text-destructive">{t("reset.passwordsMismatch")}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !allCriteriaMet || !passwordsMatch}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("reset.updatePassword")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
