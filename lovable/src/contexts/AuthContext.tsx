import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  mustChangePassword: boolean;
  clearMustChangePassword: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  isAdmin: false,
  mustChangePassword: false,
  clearMustChangePassword: () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Verify admin status server-side via edge function
  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase.functions
      .invoke("admin-users", { method: "GET" })
      .then(({ data, error }) => {
        setIsAdmin(!error && !!data?.users);
      })
      .catch(() => setIsAdmin(false));
  }, [user]);

  // Read the server-controlled force_password_reset flag from profiles
  useEffect(() => {
    if (!user) {
      setMustChangePassword(false);
      return;
    }
    supabase
      .from("profiles")
      .select("force_password_reset")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setMustChangePassword(!!(data as any)?.force_password_reset);
      });
  }, [user]);

  const clearMustChangePassword = () => {
    // The DB trigger clears force_password_reset when the password actually changes.
    setMustChangePassword(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, isAdmin, mustChangePassword, clearMustChangePassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
