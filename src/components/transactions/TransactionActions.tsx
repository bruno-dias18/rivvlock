import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/lib/mobileUtils';

interface TransactionActionsProps {
  onNewTransaction: () => void;
  stripeReady: boolean;
}

export function TransactionActions({ onNewTransaction, stripeReady }: TransactionActionsProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  return (
    <div className={`${isMobile ? 'space-y-4' : 'flex justify-between items-center'}`}>
      <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-foreground`}>
        {t('transactions.title')}
      </h1>
      <div className={`flex gap-2 ${isMobile ? 'flex-col sm:flex-row' : ''}`}>
        <Button 
          onClick={onNewTransaction}
          size={isMobile ? "default" : "default"}
          className={isMobile ? "justify-center" : ""}
        >
          <Plus className="h-4 w-4 mr-2" />
          {isMobile ? t('transactions.new') : t('transactions.newTransaction')}
        </Button>
      </div>
    </div>
  );
}
