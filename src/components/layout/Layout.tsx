import { ReactNode } from 'react';
import { Header } from './Header';
import { BottomTabBar } from './BottomTabBar';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
  showBottomNav?: boolean;
}

export const Layout = ({ children, showBottomNav = true }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className={cn(
        "container mx-auto px-4 py-6",
        showBottomNav ? "pb-20" : "pb-6"
      )}>
        {children}
      </main>
      {showBottomNav && <BottomTabBar />}
    </div>
  );
};