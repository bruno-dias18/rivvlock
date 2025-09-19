import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getAppBaseUrl } from '@/lib/appUrl';
import type { Session } from '@supabase/supabase-js';

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

interface AuthContextValue {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ error: any | null }>;
  register: (data: RegisterData) => Promise<{ error: any | null; data?: any }>;
  logout: () => Promise<{ error: any | null }>;
}

const defaultValue: AuthContextValue = {
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  async login() { return { error: null }; },
  async register() { return { error: null }; },
  async logout() { return { error: null }; },
};

export const AuthContext = createContext<AuthContextValue>(defaultValue);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingStripeCustomer, setCreatingStripeCustomer] = useState(false);

  useEffect(() => {
    // 1) Listen first
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user) {
        setTimeout(() => {
          fetchUserProfile(session.user.id, session.user.email || '');
        }, 0);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // 2) Then check current session once
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id, session.user.email || '');
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string, userEmail: string) => {
    try {
      // Fetch user profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      // Check if user is admin
      const { data: isAdminResult, error: adminError } = await supabase
        .rpc('is_admin', { check_user_id: userId });

      if (adminError) {
        console.error('Error checking admin status:', adminError);
      }

      const isAdmin = isAdminResult || userEmail === 'bruno-dias@outlook.com';

      if (profile) {
        const userProfile = {
          id: profile.user_id,
          email: userEmail,
          type: profile.user_type,
          country: profile.country,
          verified: profile.verified,
          isAdmin,
        };
        setUser(userProfile);

        // Automatically create Stripe customer if not exists and not already creating
        if (!profile.stripe_customer_id && !creatingStripeCustomer) {
          setCreatingStripeCustomer(true);
          setTimeout(() => {
            createStripeCustomer(userId, userEmail, profile);
          }, 0);
        }
      } else {
        // Fallback minimal user when profile not yet created
        const fallbackUser = { 
          id: userId, 
          email: userEmail, 
          type: 'individual' as const, 
          country: 'FR' as const, 
          verified: false,
          isAdmin
        };
        setUser(fallbackUser);
      }
    } catch (e) {
      console.error('Error fetching user profile:', e);
    } finally {
      setLoading(false);
    }
  };

  const createStripeCustomer = async (userId: string, email: string, profileData: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-customer', {
        body: {
          user_id: userId,
          email: email,
          profile_data: profileData
        }
      });

      if (error) {
        console.error('Error creating Stripe customer:', error);
      }
    } catch (error) {
      console.error('Exception creating Stripe customer:', error);
    } finally {
      setCreatingStripeCustomer(false);
    }
  };

  const login: AuthContextValue['login'] = async (email, password) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const register: AuthContextValue['register'] = async (userData) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          emailRedirectTo: `${getAppBaseUrl()}/`,
          data: {
            user_type: userData.userType,
            country: userData.country,
            first_name: userData.firstName,
            last_name: userData.lastName,
            phone: userData.phone,
            address: userData.address,
            company_name: userData.companyName,
            siret_uid: userData.siretUid,
            company_address: userData.companyAddress,
            avs_number: userData.avsNumber,
            tva_rate: userData.tvaRate?.toString(),
            vat_rate: (userData.userType === 'company' 
              ? (userData.country === 'FR' ? '20.0' : '8.1')
              : undefined)
          }
        }
      });
      return { data, error };
    } finally {
      setLoading(false);
    }
  };

  const logout: AuthContextValue['logout'] = async () => {
    try {
      // Force cleanup of client-side session data first
      setUser(null);
      setSession(null);
      
      // Clear all Supabase localStorage keys aggressively
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.startsWith('supabase.auth.'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Try local signout first to avoid 403 errors
      await supabase.auth.signOut({ scope: 'local' });
      
      // Force redirect to auth page
      window.location.replace('/auth');
      
      return { error: null };
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even on error
      setUser(null);
      setSession(null);
      
      // Clear localStorage keys even if signOut fails
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.startsWith('supabase.auth.'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      window.location.replace('/auth');
      return { error: null };
    }
  };

  const value = useMemo(() => ({ 
    user, 
    session, 
    loading, 
    isAdmin: user?.isAdmin || false,
    login, 
    register, 
    logout 
  }), [user, session, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);
