"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AuthState {
  email: string | null;
  plan: "free" | "pro" | null; // null = still loading
  token: string | null;
}

const AuthContext = createContext<AuthState>({ email: null, plan: null, token: null });

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ email: null, plan: null, token: null });

  useEffect(() => {
    const supabase = createClient();

    async function load(session: { access_token: string; user: { email?: string } } | null) {
      if (!session) {
        setState({ email: null, plan: "free", token: null });
        return;
      }
      // Fetch plan in parallel — don't set intermediate state, update everything at once
      const res = await fetch("/api/user/plan", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const plan: "free" | "pro" = res.ok ? (await res.json()).plan : "free";
      setState({ email: session.user.email ?? null, plan, token: session.access_token });
    }

    supabase.auth.getSession().then(({ data: { session } }) => load(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
