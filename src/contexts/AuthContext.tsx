import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { setUser as setSentryUser } from '@/lib/sentry';
import { queryClient } from '@/lib/queryClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, metadata?: any) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (mounted) {
          logger.info('Auth state changed:', event);
          setSession(session);
          setUser(session?.user ?? null);
          
          // Update Sentry user context for error tracking
          if (session?.user) {
            setSentryUser({ id: session.user.id, email: session.user.email });
            
            // #2 Quick Win: Prefetch critical data on login
            // Preload profile and transactions for instant navigation
            logger.info('Prefetching critical data for user:', session.user.id);
            
            queryClient.prefetchQuery({
              queryKey: ['profile', session.user.id],
              queryFn: async () => {
                const { data } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('user_id', session.user.id)
                  .single();
                return data;
              },
            });
            
            queryClient.prefetchQuery({
              queryKey: ['transactions', session.user.id],
              queryFn: async () => {
                const { data } = await supabase
                  .from('transactions')
                  .select('*')
                  .or(`user_id.eq.${session.user.id},buyer_id.eq.${session.user.id}`)
                  .order('updated_at', { ascending: false })
                  .limit(20);
                return data;
              },
            });
          } else {
            setSentryUser(null);
          }
          
          // Always mark loading as false on auth state change
          setLoading(false);
        }
      }
    );

    // Get initial session with retry for Stripe redirects
    const getInitialSession = async (retryCount = 0) => {
      try {
        logger.info('Getting initial session, attempt:', retryCount + 1);
        
        // Force a fresh session check with retry
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error('Error getting session:', error);
          
          // Retry once if there's an error (handles Stripe redirect timing)
          if (retryCount === 0) {
            setTimeout(() => {
              if (mounted) {
                getInitialSession(1);
              }
            }, 500);
            return;
          }
        }
        
        if (mounted) {
          logger.info('Session retrieved:', session ? 'Session found' : 'No session');
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      } catch (error) {
        logger.error('Error getting session:', error);
        if (mounted && retryCount === 0) {
          // Retry once on exception
          setTimeout(() => {
            if (mounted) {
              getInitialSession(1);
            }
          }, 500);
        } else if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }
  };

  const register = async (email: string, password: string, metadata?: any) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: metadata
      }
    });

    if (error) {
      logger.error('Registration error:', error);
      throw error;
    }

    // Check if user was actually created (email might already exist)
    if (data?.user && !data.user.identities?.length) {
      logger.warn('Registration attempted with existing email:', email);
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    logger.info('Registration successful for:', email);
  };

  const logout = async () => {
    try {
      logger.info('Attempting logout...');
      
      // Try to sign out via Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        logger.error('Supabase logout error:', error);
        // Don't throw - continue with local cleanup
      }
    } catch (error) {
      logger.error('Logout exception:', error);
      // Don't throw - continue with local cleanup
    } finally {
      // ALWAYS clear local state and storage, even if API fails
      logger.info('Clearing local session and storage');
      
      // Clear Sentry user context on logout
      setSentryUser(null);
      
      // Clear Supabase storage keys
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('sb-slthyxqruhfuyfmextwr-auth-token');
      
      // Reset local state
      setSession(null);
      setUser(null);
      
      // Force redirect to auth page
      logger.info('Forcing redirect to /auth');
      setTimeout(() => {
        window.location.href = '/auth';
      }, 0);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    login,
    register,
    logout,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};