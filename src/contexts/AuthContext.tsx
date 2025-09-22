import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getAppBaseUrl } from '@/lib/appUrl';
import { isMobileDevice, clearMobileCache } from '@/lib/mobileUtils';
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
  isMobileDevice: boolean;
  login: (email: string, password: string) => Promise<{ error: any | null }>;
  register: (data: RegisterData) => Promise<{ error: any | null; data?: any }>;
  logout: () => Promise<{ error: any | null }>;
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
  const [creatingStripeCustomer, setCreatingStripeCustomer] = useState(false);
  const isMobile = isMobileDevice();

  useEffect(() => {
    console.log('🔐 [AUTH] Initializing auth context (mobile:', isMobile, ')');
    
    // 1) Listen first
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 [AUTH] State change:', event, 'mobile:', isMobile);
      
      setSession(session);
      if (session?.user) {
        // On mobile, add delay to ensure stable connection
        const delay = isMobile ? 500 : 0;
        setTimeout(() => {
          fetchUserProfile(session.user.id, session.user.email || '');
        }, delay);
      } else {
        setUser(null);
        // Clear mobile cache on logout
        if (isMobile && event === 'SIGNED_OUT') {
          console.log('🧹 [AUTH] Clearing mobile cache on logout');
          clearMobileCache();
        }
      }
      setLoading(false);
    });

    // 2) Then check current session once
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔐 [AUTH] Initial session check:', !!session, 'mobile:', isMobile);
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id, session.user.email || '');
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [isMobile]);

  const fetchUserProfile = async (userId: string, userEmail: string) => {
    try {
      console.log('👤 [AUTH] Fetching profile for:', userEmail, '(mobile:', isMobile, ')');
      
      // Mobile optimization: add timeout for slower connections
      const timeoutMs = isMobile ? 15000 : 30000;
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const adminPromise = supabase
        .rpc('is_admin', { check_user_id: userId });

      // Race against timeout
      const results = await Promise.race([
        Promise.all([profilePromise, adminPromise]),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeoutMs)
        )
      ]) as [any, any];

      const [{ data: profile, error }, { data: isAdminResult, error: adminError }] = results;

      if (error) {
        console.error('❌ [AUTH] Error fetching profile:', error);
        if (isMobile && error.message.includes('timeout')) {
          console.warn('⚠️ [AUTH] Mobile timeout - will retry');
          // On mobile timeout, set fallback and retry later
          setUser({ 
            id: userId, 
            email: userEmail, 
            type: 'individual' as const, 
            country: 'FR' as const, 
            verified: false,
            isAdmin: false
          });
          setLoading(false);
          
          // Retry after delay
          setTimeout(() => fetchUserProfile(userId, userEmail), 3000);
          return;
        }
        return;
      }

      if (adminError) {
        console.error('❌ [AUTH] Error checking admin status:', adminError);
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
        console.log('✅ [AUTH] Profile loaded successfully (mobile:', isMobile, ')');

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
        console.log('⚠️ [AUTH] Using fallback user profile (mobile:', isMobile, ')');
      }
    } catch (e) {
      console.error('❌ [AUTH] Exception fetching user profile:', e);
      
      // On mobile, provide more resilient fallback
      if (isMobile) {
        setUser({ 
          id: userId, 
          email: userEmail, 
          type: 'individual' as const, 
          country: 'FR' as const, 
          verified: false,
          isAdmin: false
        });
      }
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
      console.log('🚪 [AUTH] Logout initiated (mobile:', isMobile, ')');
      
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
      
      // Mobile-specific: also clear cache
      if (isMobile) {
        console.log('🧹 [AUTH] Clearing mobile cache on logout');
        clearMobileCache();
      }
      
      // Try local signout first to avoid 403 errors
      await supabase.auth.signOut({ scope: 'local' });
      
      // Force redirect to auth page
      window.location.replace('/auth');
      
      return { error: null };
    } catch (error) {
      console.error('❌ [AUTH] Logout error:', error);
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
      
      // Mobile-specific cleanup
      if (isMobile) {
        clearMobileCache();
      }
      
      window.location.replace('/auth');
      return { error: null };
    }
  };

  const value = useMemo(() => ({ 
    user, 
    session, 
    loading, 
    isAdmin: user?.isAdmin || false,
    isMobileDevice: isMobile,
    login, 
    register, 
    logout 
  }), [user, session, loading, isMobile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);
