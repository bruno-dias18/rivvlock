import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useNewItemsNotifications } from './useNewItemsNotifications';

type CategoryKey = 'pending' | 'blocked' | 'disputed' | 'completed';

export const useTransactionsWithNewActivity = (category: CategoryKey) => {
  const { user } = useAuth();
  const { getTransactionsWithNewActivity } = useNewItemsNotifications();

  return useQuery({
    queryKey: ['transactions-new-activity', user?.id, category],
    queryFn: () => getTransactionsWithNewActivity(category),
    enabled: !!user?.id,
    staleTime: 30000,
  });
};
