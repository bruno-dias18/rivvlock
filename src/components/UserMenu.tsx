import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LogOut, User, ChevronDown, Loader2 } from 'lucide-react';
import { LanguageSelector } from '@/components/LanguageSelector';
import { toast } from 'sonner';

export function UserMenu() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Get user initials from email
  const getInitials = (email: string) => {
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email[0].toUpperCase();
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 h-10 px-3 hover:bg-muted"
        >
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
            {user?.email ? getInitials(user.email) : 'U'}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium">
              {user?.email ? getInitials(user.email) : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.email}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('common.welcome')}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-2">{t('language.selectLanguage')}</p>
              <LanguageSelector variant="full" showIcon={false} />
            </div>
          </div>
        </div>
        
        <Separator />
        
        <div className="p-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-sm h-9 px-3 hover:bg-destructive hover:text-destructive-foreground"
            disabled={isLoggingOut}
            onClick={async () => {
              setIsLoggingOut(true);
              setIsOpen(false);
              
              try {
                await logout();
                toast.success(t('common.logoutSuccess') || 'Déconnexion réussie');
              } catch (error) {
                toast.error(t('common.logoutError') || 'Erreur lors de la déconnexion');
              } finally {
                setIsLoggingOut(false);
              }
            }}
          >
            {isLoggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            {t('common.logout')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}