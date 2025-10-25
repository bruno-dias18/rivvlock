import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRecentActivity } from '@/hooks/useRecentActivity';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { fr, enUS, de } from 'date-fns/locale';
import { memo, useEffect } from 'react';
import { 
  Activity,
  ArrowRight,
  CreditCard,
  Plus,
  RefreshCw,
  CheckCircle,
  UserPlus,
  Settings,
  AlertTriangle,
  Banknote
} from 'lucide-react';

const getActivityIcon = (activityType: string) => {
  switch (activityType) {
    case 'transaction_created':
      return Plus;
    case 'funds_blocked':
      return CreditCard;
    case 'transaction_validated':
      return CheckCircle;
    case 'transaction_joined':
      return UserPlus;
    case 'buyer_joined_transaction':
      return UserPlus;
    case 'transaction_completed':
      return CheckCircle;
    case 'seller_validation':
      return CheckCircle;
    case 'buyer_validation':
      return CheckCircle;
    case 'profile_updated':
      return Settings;
    case 'dispute_created':
      return AlertTriangle;
    case 'funds_released':
      return Banknote;
    default:
      return Activity;
  }
};

const getActivityColor = (activityType: string) => {
  switch (activityType) {
    case 'transaction_created':
      return 'text-blue-500';
    case 'funds_blocked':
      return 'text-orange-500';
    case 'transaction_validated':
      return 'text-emerald-500';
    case 'transaction_joined':
      return 'text-purple-500';
    case 'buyer_joined_transaction':
      return 'text-purple-500';
    case 'transaction_completed':
      return 'text-green-600';
    case 'seller_validation':
      return 'text-blue-600';
    case 'buyer_validation':
      return 'text-green-600';
    case 'profile_updated':
      return 'text-gray-500';
    case 'dispute_created':
      return 'text-red-500';
    case 'funds_released':
      return 'text-green-600';
    default:
      return 'text-muted-foreground';
  }
};

export function RecentActivityCard() {
  const { data: activities, isLoading, refetch } = useRecentActivity();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  // Get translated title and description for activity
  const getActivityTitle = (activity: any) => {
    const translationKey = `activity.types.${activity.activity_type}.title`;
    if (i18n.exists(translationKey)) {
      return t(translationKey);
    }
    return activity.title; // Fallback to original
  };

  const getActivityDescription = (activity: any) => {
    const translationKey = `activity.types.${activity.activity_type}.description`;
    if (i18n.exists(translationKey)) {
      const transactionTitle = activity.transaction?.title || activity.metadata?.transaction_title || activity.metadata?.title || 'Transaction';
      return t(translationKey, { title: transactionTitle });
    }
    return activity.description; // Fallback to original
  };

  // Get locale for date formatting
  const getDateLocale = () => {
    switch (i18n.language) {
      case 'en': return enUS;
      case 'de': return de;
      default: return fr;
    }
  };

  // Map activity types to transaction tabs
  const getTabForActivity = (activityType: string): string => {
    switch (activityType) {
      case 'transaction_created':
      case 'buyer_joined_transaction':
        return 'pending';
      case 'funds_blocked':
        return 'blocked';
      case 'dispute_created':
        return 'disputed';
      case 'funds_released':
      case 'transaction_completed':
      case 'seller_validation':
      case 'buyer_validation':
        return 'completed';
      default:
        return 'pending';
    }
  };

  // Handle click on activity item
  const handleActivityClick = (activity: any) => {
    const metadata = activity.metadata as Record<string, any> | null;
    const transactionId = metadata?.transaction_id;

    // For profile-related activities, go to profile
    if (activity.activity_type === 'profile_updated') {
      navigate('/dashboard/profile');
      return;
    }

    // For transaction-related activities, go to transactions with appropriate tab
    const tab = getTabForActivity(activity.activity_type);
    
    if (transactionId) {
      navigate(`/dashboard/transactions?tab=${tab}&scrollTo=${transactionId}`);
    } else {
      navigate(`/dashboard/transactions?tab=${tab}`);
    }
  };

  // Auto-refresh activity data every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 15000);

    return () => clearInterval(interval);
  }, [refetch]);

  const handleViewAll = () => {
    navigate('/activity-history');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">{t('activity.recentActivity')}</CardTitle>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleViewAll}
          className="text-muted-foreground hover:text-foreground"
        >
          {t('activity.viewAll')} <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-3 animate-pulse">
                <div className="w-8 h-8 bg-muted rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : activities && activities.length > 0 ? (
          activities.map((activity) => {
            const IconComponent = getActivityIcon(activity.activity_type);
            const iconColor = getActivityColor(activity.activity_type);
            
            return (
              <button 
                key={activity.id} 
                onClick={() => handleActivityClick(activity)}
                className="flex items-start space-x-3 group w-full text-left p-2 -mx-2 rounded-lg hover:bg-accent/50 transition-all duration-200 hover:translate-x-1 cursor-pointer"
              >
                <div className={`mt-0.5 ${iconColor}`}>
                  <IconComponent className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {getActivityTitle(activity)}
                  </p>
                  {getActivityDescription(activity) && (
                    <p className="text-xs text-muted-foreground truncate">
                      {getActivityDescription(activity)}
                    </p>
                  )}
                   <p className="text-xs text-muted-foreground">
                     {formatDistanceToNow(new Date(activity.created_at), { 
                       addSuffix: true, 
                       locale: getDateLocale() 
                     })}
                   </p>
                </div>
              </button>
            );
          })
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Activity className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">{t('activity.noRecentActivity')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default memo(RecentActivityCard);