import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

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

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      } catch (error) {
        logger.error('Error getting session:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      }
    );

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