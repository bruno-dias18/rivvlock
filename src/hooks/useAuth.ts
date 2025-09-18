import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  type: 'individual' | 'company' | 'independent';
  country: 'FR' | 'CH';
  verified: boolean;
}

interface RegisterData {
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

export const useAuth = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (session?.user) {
          // Defer profile fetching to avoid deadlock
          setTimeout(() => {
            fetchUserProfile(session.user.id, session.user.email || '');
          }, 0);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    // Check for existing session
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
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      if (profile) {
        setUser({
          id: profile.user_id,
          email: userEmail,
          type: profile.user_type,
          country: profile.country,
          verified: profile.verified
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: RegisterData) => {
    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (error) {
        // Handle specific error types
        if (error.message.includes('User already registered')) {
          return { error: { ...error, message: 'Cette adresse e-mail est déjà utilisée. Essayez de vous connecter.' } };
        }
        if (error.message.includes('For security purposes')) {
          const match = error.message.match(/(\d+)\s+seconds?/);
          const seconds = match ? match[1] : '60';
          return { error: { ...error, message: `Pour des raisons de sécurité, veuillez attendre ${seconds} secondes avant de réessayer.` } };
        }
        return { error };
      }

      // Only create profile if user signup was successful and user is confirmed
      if (data.user && !data.user.email_confirmed_at) {
        // For unconfirmed users, we'll create the profile when they confirm their email
        return { data, error: null };
      }

      if (data.user && data.user.email_confirmed_at) {
        // User is confirmed, create profile
        const profileData = {
          user_id: data.user.id,
          user_type: userData.userType,
          country: userData.country,
          first_name: userData.firstName,
          last_name: userData.lastName,
          phone: userData.phone,
          address: userData.address,
          company_name: userData.companyName,
          siret_uid: userData.siretUid,
          company_address: userData.companyAddress,
          iban: userData.iban,
          avs_number: userData.avsNumber,
          tva_rate: userData.tvaRate,
          vat_rate: userData.userType === 'company' 
            ? (userData.country === 'FR' ? 20.0 : 8.1)
            : undefined,
          verified: false
        };

        const { error: profileError } = await supabase
          .from('profiles')
          .insert([profileData]);

        if (profileError) {
          console.error('Error creating profile:', profileError);
          return { error: profileError };
        }
      }

      return { data, error: null };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      setSession(null);
    }
    return { error };
  };

  return {
    user,
    session,
    loading,
    login,
    register,
    logout,
  };
};