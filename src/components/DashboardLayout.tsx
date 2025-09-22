import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Button } from '@/components/ui/button';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        
        <SidebarInset className="flex-1">
          {/* Header */}
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <div className="h-6 w-px bg-border" />
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{user?.email}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-muted-foreground hover:text-foreground"
              >
                {t('common.logout')}
              </Button>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}