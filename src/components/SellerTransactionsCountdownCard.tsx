import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export const SellerTransactionsCountdownCard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['seller-transactions-countdown', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'paid')
        .not('seller_validation_deadline', 'is', null)
        .order('seller_validation_deadline', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const formatTimeRemaining = (deadline: string | null) => {
    if (!deadline) return null;

    const deadlineDate = new Date(deadline);
    const diff = deadlineDate.getTime() - currentTime.getTime();

    if (diff <= 0) return { expired: true, text: t('common.expired') };

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (days > 0) {
      return { expired: false, text: `${days}j ${hours}h ${minutes}m` };
    } else if (hours > 0) {
      return { expired: false, text: `${hours}h ${minutes}m ${seconds}s` };
    } else {
      return { expired: false, text: `${minutes}m ${seconds}s` };
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('profile.transactionsCountdown')}
          </CardTitle>
          <CardDescription>{t('profile.validationDeadlines')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('common.loading')}...</p>
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('profile.transactionsCountdown')}
          </CardTitle>
          <CardDescription>{t('profile.validationDeadlines')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('profile.noActiveTransactions')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {t('profile.transactionsCountdown')}
        </CardTitle>
        <CardDescription>{t('profile.validationDeadlines')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {transactions.map((transaction) => {
          const autoReleaseTime = formatTimeRemaining(transaction.validation_deadline);

          return (
            <Link 
              key={transaction.id} 
              to="/dashboard/transactions"
              className="block"
            >
              <div className="border rounded-lg p-4 hover:bg-accent/50 transition-colors space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{transaction.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {transaction.price} {transaction.currency}
                    </p>
                  </div>
                </div>

                {/* Auto release countdown */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <p className="text-xs font-medium">
                      {t('profile.automaticRelease')}
                    </p>
                  </div>
                  {autoReleaseTime ? (
                    <Badge 
                      variant={autoReleaseTime.expired ? "destructive" : "secondary"}
                      className="text-xs font-mono"
                    >
                      {autoReleaseTime.text}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {t('common.noDeadline')}
                    </Badge>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
};
