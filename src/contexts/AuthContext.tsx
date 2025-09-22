import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email: string;
  type: 'individual' | 'company' | 'independent';
  country: 'FR' | 'CH';
  verified: boolean;
  isAdmin: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  userType: 'individual' | 'company' | 'independent';
  country: 'FR' | 'CH';
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  companyName?: string;
  siretUid?: string;
  companyAddress?: string;
  iban?: string;
  avsNumber?: string;
  tvaRate?: number;
}

export interface AuthContextValue {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isMobileDevice: boolean;
  login: (email: string, password: string) => Promise<{ error: any }>;
  register: (userData: RegisterData) => Promise<{ data?: any; error: any }>;
  logout: () => Promise<{ error: any }>;
}

const defaultValue: AuthContextValue = {
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  isMobileDevice: false,
  async login() { return { error: null }; },
  async register() { return { error: null }; },
  async logout() { return { error: null }; },
};

export const AuthContext = createContext<AuthContextValue>(defaultValue);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [isAdminStatus, setIsAdminStatus] = useState(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            type: 'individual',
            country: 'FR',
            verified: false,
            isAdmin: false
          });
          
          // Check admin status after setting user (avoid deadlock)
          setTimeout(async () => {
            try {
              const { data: adminStatus } = await supabase.rpc('get_current_user_admin_status');
              setIsAdminStatus(adminStatus || false);
            } catch (error) {
              console.error('Error checking admin status:', error);
              setIsAdminStatus(false);
            }
          }, 0);
        } else {
          setUser(null);
          setIsAdminStatus(false);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        
        if (initialSession?.user) {
          setUser({
            id: initialSession.user.id,
            email: initialSession.user.email || '',
            type: 'individual',
            country: 'FR',
            verified: false,
            isAdmin: false
          });
          
          // Check admin status
          setTimeout(async () => {
            try {
              const { data: adminStatus } = await supabase.rpc('get_current_user_admin_status');
              setIsAdminStatus(adminStatus || false);
            } catch (error) {
              console.error('Error checking admin status:', error);
              setIsAdminStatus(false);
            }
          }, 0);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: RegisterData) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            user_type: userData.userType,
            country: userData.country,
            first_name: userData.firstName,
            last_name: userData.lastName
          }
        }
      });
      return { data, error };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setUser(null);
      setSession(null);
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      window.location.replace('/auth');
      return { error };
    } catch (error) {
      console.error('Logout error:', error);
      return { error };
    }
  };

  const value = useMemo(() => ({ 
    user, 
    session, 
    loading, 
    isAdmin: isAdminStatus,
    isMobileDevice: false,
    login, 
    register, 
    logout 
  }), [user, session, loading, isAdminStatus]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);