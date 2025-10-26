import { Home, CreditCard, FileText, FileSignature, User, Users, AlertTriangle, ShieldCheck, Wallet } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useUnreadAdminMessages } from '@/hooks/useUnreadAdminMessages';
import { useUnreadDisputesGlobal } from '@/hooks/useUnreadDisputesGlobal';
import { useUnreadQuotesGlobal } from '@/hooks/useUnreadQuotesGlobal';
import { useUnreadTransactionsGlobal } from '@/hooks/useUnreadTransactionsGlobal';
import { Badge } from '@/components/ui/badge';

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
    title: 'navigation.quotes',
    url: '/dashboard/quotes',
    icon: FileSignature,
  },
  {
    title: 'navigation.reports',
    url: '/dashboard/reports',
    icon: FileText,
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
  const { unreadCount } = useUnreadAdminMessages();
  const { unreadCount: disputesUnread } = useUnreadDisputesGlobal();
  const { unreadCount: quotesUnread } = useUnreadQuotesGlobal();
  const { unreadCount: transactionsUnread } = useUnreadTransactionsGlobal();

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  // Navigation différente pour admins
  const allItems = isAdmin ? [
    {
      title: 'Litiges',
      url: '/dashboard/admin/disputes',
      icon: AlertTriangle,
    },
    {
      title: 'KYC',
      url: '/dashboard/admin/kyc',
      icon: ShieldCheck,
    },
    {
      title: 'Paiements',
      url: '/dashboard/admin/payouts',
      icon: Wallet,
    },
    {
      title: 'Admin',
      url: '/dashboard/admin',
      icon: Users,
    },
  ] : [...navigationItems];

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
              <div className="relative">
                <item.icon className={`h-5 w-5 mb-1 ${isItemActive ? 'text-primary' : ''}`} />
                {/* Badge disputes pour users normaux */}
                {!isAdmin && item.url === '/dashboard/transactions' && (transactionsUnread > 0 || disputesUnread > 0) && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-2 h-4 min-w-[16px] px-1 flex items-center justify-center text-[10px] font-bold"
                  >
                    {(transactionsUnread + disputesUnread) > 9 ? '9+' : (transactionsUnread + disputesUnread)}
                  </Badge>
                )}
                {/* Badge quotes pour users normaux */}
                {!isAdmin && item.url === '/dashboard/quotes' && quotesUnread > 0 && (
                  <Badge 
                    className="absolute -top-1 -right-2 h-4 min-w-[16px] px-1 flex items-center justify-center text-[10px] font-bold bg-purple-500 hover:bg-purple-600"
                  >
                    {quotesUnread > 9 ? '9+' : quotesUnread}
                  </Badge>
                )}
                {/* Badge litiges pour admins */}
                {isAdmin && item.url === '/dashboard/admin/disputes' && disputesUnread > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-2 h-4 min-w-[16px] px-1 flex items-center justify-center text-[10px] font-bold"
                  >
                    {disputesUnread > 9 ? '9+' : disputesUnread}
                  </Badge>
                )}
              </div>
              <span className="text-xs font-medium truncate">
                {isAdmin ? item.title : t(item.title)}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}