import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const GUEST_USER: User = {
  id: "guest-user-id",
  app_metadata: {},
  user_metadata: { full_name: "Maestro Sound" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
  email: "contato@maestrosound.com",
};

const AuthContext = createContext<AuthState>({
  session: null,
  user: GUEST_USER,
  loading: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const currentUser = session?.user ?? GUEST_USER;

  return (
    <AuthContext.Provider value={{ session, user: currentUser, loading: false, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

