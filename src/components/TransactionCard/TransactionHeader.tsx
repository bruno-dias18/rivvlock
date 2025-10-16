import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { CardDescription, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/lib/mobileUtils';

interface TransactionHeaderProps {
  title: string;
  description: string;
  userRole: 'seller' | 'buyer' | null;
}

const TransactionHeaderComponent = ({ title, description, userRole }: TransactionHeaderProps) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  return (
    <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-start'}`}>
      <div className="flex-1">
        <CardTitle className={`${isMobile ? 'text-base' : 'text-lg'}`}>{title}</CardTitle>
        <CardDescription className="mt-1">
          {description}
        </CardDescription>
      </div>
      <div className={`${isMobile ? 'flex justify-between items-center' : 'text-right ml-4'}`}>
        <Badge variant="outline" className="mt-1">
          {userRole === 'seller' ? t('roles.seller') : t('roles.client')}
        </Badge>
      </div>
    </div>
  );
};

export const TransactionHeader = memo(TransactionHeaderComponent);
