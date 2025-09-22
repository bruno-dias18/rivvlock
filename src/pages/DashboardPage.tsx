import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">{user?.email}</span>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-medium text-card-foreground mb-2">
              Transactions
            </h3>
            <p className="text-muted-foreground text-sm">
              Manage your escrow transactions
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-medium text-card-foreground mb-2">
              Profile
            </h3>
            <p className="text-muted-foreground text-sm">
              Update your profile information
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-medium text-card-foreground mb-2">
              Security
            </h3>
            <p className="text-muted-foreground text-sm">
              Manage account security settings
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}