import { ReactNode } from 'react';
import { Header } from './Header';
import { BottomTabBar } from './BottomTabBar';
import { OfflineIndicator } from './OfflineIndicator';
import { MobileSyncStatus } from '@/components/mobile/MobileSyncStatus';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { isObsoleteUrl, forceCorrectUrl } from '@/lib/appUrl';

interface LayoutProps {
  children: ReactNode;
  showBottomNav?: boolean;
}

export const Layout = ({ children, showBottomNav = true }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <OfflineIndicator />
      {typeof window !== 'undefined' && isObsoleteUrl() && (
        <div role="alert" className="w-full bg-destructive/10 border-b border-destructive/30 text-destructive">
          <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-3">
            <span className="text-sm">Vous êtes sur une ancienne adresse. Basculez vers le domaine correct pour continuer.</span>
            <Button size="sm" variant="destructive" onClick={forceCorrectUrl}>
              Basculer maintenant
            </Button>
          </div>
        </div>
      )}
      <Header />
      <main className="container mx-auto px-4 pt-20 pb-20 max-w-7xl">
        {children}
      </main>
      <BottomTabBar />
      <MobileSyncStatus />
    </div>
  );
};