import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProfileAccessLogs } from '@/hooks/useProfileAccessLogs';
import { useTranslation } from 'react-i18next';
import { Eye, Shield, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, de } from 'date-fns/locale';

export const ProfileAccessLogsCard = () => {
  const { t, i18n } = useTranslation();
  const { data: logs, isLoading } = useProfileAccessLogs();
  
  const getLocale = () => {
    switch (i18n.language) {
      case 'fr': return fr;
      case 'de': return de;
      default: return enUS;
    }
  };

  const getAccessTypeLabel = (type: string) => {
    switch (type) {
      case 'admin_profile_access':
        return t('profile.accessLogs.adminAccess');
      case 'counterparty_view':
        return t('profile.accessLogs.counterpartyView');
      case 'stripe_status_view':
        return t('profile.accessLogs.stripeStatusView');
      case 'admin_stripe_access':
        return t('profile.accessLogs.adminStripeAccess');
      case 'email_access':
        return t('profile.accessLogs.emailAccess');
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {t('profile.accessLogs.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          {t('profile.accessLogs.title')}
        </CardTitle>
        <CardDescription>
          {t('profile.accessLogs.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!logs || logs.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            {t('profile.accessLogs.noAccess')}
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50"
              >
                <Eye className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">
                    {getAccessTypeLabel(log.access_type)}
                  </p>
                  {log.accessed_fields && log.accessed_fields.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t('profile.accessLogs.fields')}: {log.accessed_fields.join(', ')}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(log.created_at), 'PPp', { locale: getLocale() })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
