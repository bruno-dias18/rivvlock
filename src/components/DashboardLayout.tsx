import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomTabBar } from './BottomTabBar';
import { UserMenu } from './UserMenu';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col min-h-screen w-full">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
        <div className="flex items-center gap-2">
          <img 
            src="/assets/rivvlock-logo.jpg" 
            alt="RIVVLOCK Logo" 
            className="h-8 w-8 rounded-md object-contain"
          />
          <span className="font-bold text-foreground">RIVVLOCK</span>
        </div>
        
        <div className="ml-auto">
          <UserMenu />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 pb-20">
        {children}
      </main>

      {/* Bottom Tab Bar */}
      <BottomTabBar />
    </div>
  );
}