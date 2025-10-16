import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomTabBar } from './BottomTabBar';
import { UserMenu } from './UserMenu';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { RefreshCw } from 'lucide-react';
import { useDisputeRealtimeNotifications } from '@/hooks/useDisputeRealtimeNotifications';

interface DashboardLayoutProps {
  children: ReactNode;
  onSyncPayments?: () => Promise<void>;
}

export function DashboardLayout({ children, onSyncPayments }: DashboardLayoutProps) {
  const { t } = useTranslation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  useDisputeRealtimeNotifications();
  return (
    <div className="flex flex-col min-h-screen w-full overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
        <div className="flex items-center gap-2">
          <img 
            src="/assets/rivvlock-logo-icon.png" 
            alt="RIVVLOCK Icon" 
            className="h-8 w-8 object-contain"
          />
          <img 
            src="/assets/rivvlock-logo-text.png" 
            alt="RIVVLOCK" 
            className="h-6 w-auto object-contain"
          />
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
                  <p>{t('common.syncPayments')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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