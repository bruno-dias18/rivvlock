import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, CreditCard, User, Settings, BarChart3, Users, AlertTriangle, FileText } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useUnreadDisputesGlobal } from '@/hooks/useUnreadDisputesGlobal';
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

const adminItems = [
  {
    title: 'Litiges',
    url: '/dashboard/admin/disputes',
    icon: AlertTriangle,
  },
  {
    title: 'navigation.admin',
    url: '/dashboard/admin',
    icon: Users,
  },
];

export function AppSidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useAuth();
  const { state } = useSidebar();
  const { isAdmin } = useIsAdmin();
  const { unreadCount: disputesUnread } = useUnreadDisputesGlobal();

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
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <span className="text-sm font-bold text-primary-foreground">R</span>
          </div>
          {state === 'expanded' && (
            <span className="font-bold text-foreground">RIVVLOCK</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('dashboard.welcome')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
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
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>{t('admin.dashboard')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
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
        )}
      </SidebarContent>
    </Sidebar>
  );
}