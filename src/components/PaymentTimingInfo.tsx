import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function PaymentTimingInfo() {
  const { t } = useTranslation();

  return (
    <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
      <div className="flex items-start gap-2">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">{t('paymentTiming.note')}:</strong>{' '}
            {t('paymentTiming.noteDesc')}
          </p>
        </div>
      </div>
    </div>
  );
}
