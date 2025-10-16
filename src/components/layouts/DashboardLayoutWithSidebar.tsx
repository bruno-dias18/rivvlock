import { ReactNode } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { UserMenu } from '@/components/UserMenu';
import { BottomTabBar } from '@/components/BottomTabBar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useDisputeRealtimeNotifications } from '@/hooks/useDisputeRealtimeNotifications';
import { useIsMobile } from '@/lib/mobileUtils';

interface Props {
  children: ReactNode;
  onSyncPayments?: () => Promise<void>;
}

export function DashboardLayoutWithSidebar({ children, onSyncPayments }: Props) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMobile = useIsMobile();
  useDisputeRealtimeNotifications();

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="min-h-screen flex w-full">
        {/* Desktop Sidebar - Hidden on mobile */}
        {!isMobile && <AppSidebar />}

        {/* Main content area */}
        <SidebarInset className="flex-1 flex flex-col">
          {/* Header */}
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
            <div className="flex items-center gap-2">
              {/* Desktop: Sidebar toggle button */}
              {!isMobile && <SidebarTrigger />}
              
              {/* Mobile: Logo always visible */}
              {isMobile && (
                <>
                  <img 
                    src="/assets/rivvlock-logo-icon.png" 
                    alt="RIVVLOCK Icon" 
                    className="h-8 w-8 object-contain"
                  />
                  <img 
                    src="/assets/rivvlock-logo-text.png" 
                    alt="RIVVLOCK" 
                    className="h-4 w-auto object-contain"
                  />
                </>
              )}
            </div>
            
            <div className="flex items-center gap-2 ml-auto">
              {onSyncPayments && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={async () => {
                          setIsRefreshing(true);
                          try {
                            await onSyncPayments();
                          } finally {
                            setIsRefreshing(false);
                          }
                        }}
                        disabled={isRefreshing}
                      >
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Synchroniser les paiements</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <UserMenu />
            </div>
          </header>

          {/* Main Content - padding-bottom for mobile tab bar */}
          <main className={`flex-1 p-6 ${isMobile ? 'pb-20' : ''}`}>
            {children}
          </main>

          {/* Mobile Bottom Tab Bar */}
          {isMobile && <BottomTabBar />}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
