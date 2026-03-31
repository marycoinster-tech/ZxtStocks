import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { authService } from '@/lib/auth-service';
import { AuthUser } from '@/types';
import { User } from '@supabase/supabase-js';

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && session?.user) {
        login(authService.mapUser(session.user));
      }
      if (mounted) setLoading(false);
    });

    // Safety #2: Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        console.log('Auth state change:', event);

        if (event === 'SIGNED_IN' && session?.user) {
          login(authService.mapUser(session.user));
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          logout();
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          login(authService.mapUser(session.user));
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
