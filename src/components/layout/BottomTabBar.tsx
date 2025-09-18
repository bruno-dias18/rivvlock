import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Home, CreditCard, User } from 'lucide-react';

interface TabItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

export const BottomTabBar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const tabs: TabItem[] = [
    {
      path: '/',
      label: t('navigation.home'),
      icon: <Home className="w-5 h-5" />
    },
    {
      path: '/transactions',
      label: t('navigation.transactions'),
      icon: <CreditCard className="w-5 h-5" />
    },
    {
      path: '/profile',
      label: t('navigation.profile'),
      icon: <User className="w-5 h-5" />
    }
  ];

  return (
    <div className="bottom-tab-bar">
      <div className="flex items-center justify-around px-2 py-2 safe-area-pb">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200",
                "min-w-0 flex-1 text-xs font-medium",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {tab.icon}
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};