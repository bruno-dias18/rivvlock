import { ReactNode } from 'react';
import { Header } from './Header';
import { BottomTabBar } from './BottomTabBar';
import { OfflineIndicator } from './OfflineIndicator';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
  showBottomNav?: boolean;
}

export const Layout = ({ children, showBottomNav = true }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <OfflineIndicator />
      <Header />
      <main className="container mx-auto px-4 pt-20 pb-20 max-w-7xl">
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
};