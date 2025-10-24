import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, CreditCard, User, Settings, BarChart3, Users, AlertTriangle, FileText, FileSignature, Bug } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useUnreadDisputesGlobal } from '@/hooks/useUnreadDisputesGlobal';
import { useUnreadQuotesGlobal } from '@/hooks/useUnreadQuotesGlobal';
import { Badge } from '@/components/ui/badge';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';

// Navigation pour les utilisateurs normaux (non-admin)
const userNavigationItems = [
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
    title: 'Devis',
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

// Navigation pour les admins uniquement
const adminNavigationItems = [
  {
    title: 'navigation.admin',
    url: '/dashboard/admin',
    icon: Users,
  },
  {
    title: 'Transactions',
    url: '/dashboard/transactions',
    icon: CreditCard,
  },
  {
    title: 'Transactions problématiques',
    url: '/dashboard/admin/problematic',
    icon: AlertTriangle,
  },
  {
    title: "Logs d'activité",
    url: '/dashboard/admin/logs',
    icon: FileText,
  },
  {
    title: 'Utilisateurs',
    url: '/dashboard/admin/users',
    icon: Users,
  },
  {
    title: 'Litiges',
    url: '/dashboard/admin/disputes',
    icon: AlertTriangle,
  },
  {
    title: 'Test Sentry',
    url: '/dashboard/admin/test-sentry',
    icon: Bug,
  },
];

export function AppSidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useAuth();
  const { state } = useSidebar();
  const { isAdmin } = useIsAdmin();
  const { unreadCount: disputesUnread } = useUnreadDisputesGlobal();
  const { unreadCount: quotesUnread } = useUnreadQuotesGlobal();

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <img 
            src="/assets/rivvlock-logo-icon.webp" 
            alt="RIVVLOCK Icon" 
            className="h-8 w-8 object-contain"
            width="32"
            height="32"
            loading="eager"
          />
          {state === 'expanded' && (
            <img 
              src="/assets/rivvlock-logo-text.webp" 
              alt="RIVVLOCK" 
              className="h-4 w-auto object-contain"
              loading="eager"
            />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Navigation pour admins uniquement */}
        {isAdmin ? (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavigationItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{t(item.title)}</span>
                        {item.url === '/dashboard/admin/disputes' && disputesUnread > 0 && (
                          <Badge 
                            variant="destructive" 
                            className="ml-auto h-5 min-w-[20px] px-1.5 flex items-center justify-center text-[10px] font-bold"
                          >
                            {disputesUnread > 9 ? '9+' : disputesUnread}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          /* Navigation pour utilisateurs normaux */
          <SidebarGroup>
            <SidebarGroupLabel>{t('dashboard.welcome')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {userNavigationItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{t(item.title)}</span>
                        {item.url === '/dashboard/transactions' && disputesUnread > 0 && (
                          <Badge 
                            variant="destructive" 
                            className="ml-auto h-5 min-w-[20px] px-1.5 flex items-center justify-center text-[10px] font-bold"
                          >
                            {disputesUnread > 9 ? '9+' : disputesUnread}
                          </Badge>
                        )}
                        {item.url === '/dashboard/quotes' && quotesUnread > 0 && (
                          <Badge 
                            className="ml-auto h-5 min-w-[20px] px-1.5 flex items-center justify-center text-[10px] font-bold bg-purple-500 hover:bg-purple-600"
                          >
                            {quotesUnread > 9 ? '9+' : quotesUnread}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}