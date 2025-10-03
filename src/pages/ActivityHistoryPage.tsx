import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useActivityHistory } from '@/hooks/useActivityHistory';
import { useIsMobile } from '@/lib/mobileUtils';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Activity,
  CreditCard,
  Plus,
  RefreshCw,
  CheckCircle,
  UserPlus,
  Settings,
  AlertTriangle,
  Banknote,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const getActivityIcon = (activityType: string) => {
  switch (activityType) {
    case 'transaction_created':
      return Plus;
    case 'payment_received':
      return CreditCard;
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
    case 'payment_sync':
      return RefreshCw;
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
    case 'payment_received':
      return 'text-green-500';
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
    case 'payment_sync':
      return 'text-orange-500';
    case 'dispute_created':
      return 'text-red-500';
    case 'funds_released':
      return 'text-green-600';
    default:
      return 'text-muted-foreground';
  }
};

export default function ActivityHistoryPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [limit] = useState(50);
  const { data: activities, isLoading } = useActivityHistory(limit);

  const handleBack = () => {
    navigate('/dashboard');
  };

  const getTabForActivity = (activityType: string) => {
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

  const handleActivityClick = (activity: any) => {
    if (activity.activity_type === 'profile_updated') {
      navigate('/dashboard/profile');
    } else {
      const tab = getTabForActivity(activity.activity_type);
      navigate(`/dashboard/transactions?tab=${tab}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className={`${isMobile ? 'space-y-4' : 'flex items-center justify-between'}`}>
          <div className={`flex items-center ${isMobile ? 'space-x-2' : 'space-x-4'}`}>
            <Button
              variant="ghost"
              size={isMobile ? "sm" : "sm"}
              onClick={handleBack}
              className={`text-muted-foreground hover:text-foreground ${isMobile ? 'min-w-0' : ''}`}
            >
              <ArrowLeft className={`${isMobile ? 'h-4 w-4' : 'h-4 w-4 mr-1'}`} />
              {!isMobile && 'Retour'}
            </Button>
            <div>
              <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>Historique d'activité</h1>
              {!isMobile && (
                <p className="text-muted-foreground">
                  Toutes vos activités récentes
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Activity List */}
        <Card>
          <CardHeader>
            <CardTitle>Toutes les activités</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-4 animate-pulse">
                    <div className="w-10 h-10 bg-muted rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                      <div className="h-3 bg-muted rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activities && activities.length > 0 ? (
              <div className="space-y-1">
                {activities.map((activity) => {
                  const IconComponent = getActivityIcon(activity.activity_type);
                  const iconColor = getActivityColor(activity.activity_type);
                  
                  return (
                    <button
                      key={activity.id}
                      onClick={() => handleActivityClick(activity)}
                      className={`w-full text-left flex items-start ${isMobile ? 'space-x-3 p-3' : 'space-x-4 p-4'} rounded-lg hover:bg-muted/50 transition-colors cursor-pointer`}
                    >
                      <div className={`mt-1 ${iconColor} flex-shrink-0`}>
                        <IconComponent className={`${isMobile ? 'h-5 w-5' : 'h-6 w-6'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className={`font-medium text-foreground ${isMobile ? 'text-sm' : ''}`}>
                              {activity.title}
                            </p>
                            {activity.description && (
                              <p className={`text-muted-foreground mt-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                                {activity.description}
                              </p>
                            )}
                            <div className={`flex items-center mt-2 text-muted-foreground ${isMobile ? 'text-xs space-x-2' : 'text-xs space-x-4'}`}>
                              <span>
                                {formatDistanceToNow(new Date(activity.created_at), {
                                  addSuffix: true,
                                  locale: fr
                                })}
                              </span>
                              {!isMobile && (
                                <>
                                  <span>•</span>
                                  <span>
                                    {format(new Date(activity.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Activity className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucune activité</h3>
                <p className="text-muted-foreground">
                  Votre historique d'activité apparaîtra ici une fois que vous aurez commencé à utiliser l'application.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}