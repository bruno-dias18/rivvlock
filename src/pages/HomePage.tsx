import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Footer } from '@/components/Footer';
import { InstallPromptBanner } from '@/components/InstallPromptBanner';

export default function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              RivvLock
            </h1>
            <p className="text-muted-foreground">
              Secure escrow transactions made simple
            </p>
          </div>

          {user ? (
            <div className="space-y-4">
              <p className="text-foreground">
                Welcome back, {user.email}!
              </p>
              <div className="space-y-2">
                <Link
                  to="/dashboard"
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
                >
                  Go to Dashboard
                </Link>
                <button
                  onClick={logout}
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-border text-sm font-medium rounded-md text-foreground bg-background hover:bg-muted transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Link
                to="/auth"
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
              >
                Get Started
              </Link>
              <InstallPromptBanner />
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}