import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, CreditCard, User, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useIsAdmin } from '@/hooks/useIsAdmin';

const navigationItems = [
  {
    title: 'navigation.home',
    url: '/dashboard',
    icon: Home,
  },
  {
    title: 'navigation.transactions', 
    url: '/dashboard/transactions',
    icon: CreditCard,
  },
  {
    title: 'navigation.profile',
    url: '/dashboard/profile',
    icon: User,
  },
];

export function BottomTabBar() {
  const { t } = useTranslation();
  const location = useLocation();
  const { isAdmin } = useIsAdmin();

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const allItems = [...navigationItems];
  if (isAdmin) {
    allItems.push({
      title: 'navigation.admin',
      url: '/dashboard/admin',
      icon: Users,
    });
  }

  return (
    <nav className="bottom-tab-bar fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-border">
      <div className="flex items-center justify-around px-2 py-2">
        {allItems.map((item) => {
          const isItemActive = isActive(item.url);
          return (
            <NavLink
              key={item.title}
              to={item.url}
              className={`flex flex-col items-center justify-center min-w-0 flex-1 px-2 py-2 rounded-lg transition-colors ${
                isItemActive 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <item.icon className={`h-5 w-5 mb-1 ${isItemActive ? 'text-primary' : ''}`} />
              <span className="text-xs font-medium truncate">
                {t(item.title)}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}