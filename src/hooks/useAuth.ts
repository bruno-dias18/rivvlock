import { useState } from 'react';

// Mock auth hook for demo purposes
// TODO: Replace with real Supabase auth once connected

interface User {
  id: string;
  email: string;
  type: 'individual' | 'company';
  country: 'FR' | 'CH';
  verified: boolean;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>({
    id: '1',
    email: 'demo@rivvlock.com',
    type: 'company',
    country: 'FR',
    verified: true
  });
  const [loading, setLoading] = useState(false);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      // Mock login - in real app, use Supabase auth
      await new Promise(resolve => setTimeout(resolve, 1000));
      setUser({
        id: '1',
        email,
        type: 'company',
        country: 'FR',
        verified: true
      });
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: any) => {
    setLoading(true);
    try {
      // Mock registration - in real app, use Supabase auth
      await new Promise(resolve => setTimeout(resolve, 1000));
      setUser({
        id: '1',
        email: userData.email,
        type: userData.userType,
        country: userData.country,
        verified: false
      });
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
  };

  return {
    user,
    loading,
    login,
    register,
    logout,
  };
};