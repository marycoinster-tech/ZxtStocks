import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { authService } from '@/lib/auth-service';
import { AuthUser } from '@/types';
import { User } from '@supabase/supabase-js';

/** Fetch referral_code from user_profiles and merge into AuthUser */
async function enrichWithProfile(authUser: AuthUser): Promise<AuthUser> {
  const { data } = await supabase
    .from('user_profiles')
    .select('referral_code')
    .eq('id', authUser.id)
    .maybeSingle();
  if (data?.referral_code) {
    return { ...authUser, referralCode: data.referral_code };
  }
  return authUser;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const login = (authUser: AuthUser) => {
    setUser(authUser);
  };

  const logout = () => {
    setUser(null);
  };

  useEffect(() => {
    let mounted = true;

    // Safety #1: Check existing session (page refresh)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (mounted && session?.user) {
        const base = authService.mapUser(session.user);
        const enriched = await enrichWithProfile(base);
        if (mounted) login(enriched);
      }
      if (mounted) setLoading(false);
    });

    // Safety #2: Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        console.log('Auth state change:', event);

        if (event === 'SIGNED_IN' && session?.user) {
          const base = authService.mapUser(session.user);
          enrichWithProfile(base).then((enriched) => {
            if (mounted) login(enriched);
          });
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          logout();
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          const base = authService.mapUser(session.user);
          enrichWithProfile(base).then((enriched) => {
            if (mounted) login(enriched);
          });
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
