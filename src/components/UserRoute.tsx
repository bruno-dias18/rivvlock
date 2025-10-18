import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useIsAdmin } from '@/hooks/useIsAdmin';

interface UserRouteProps {
  children: ReactNode;
}

/**
 * Protège les routes utilisateur
 * Les admins sont redirigés vers /dashboard/admin
 */
export const UserRoute = ({ children }: UserRouteProps) => {
  const { isAdmin, loading } = useIsAdmin();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Si l'utilisateur est admin, rediriger vers le dashboard admin
  if (isAdmin) {
    return <Navigate to="/dashboard/admin" replace />;
  }

  return <>{children}</>;
};
