import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Calendar, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function PaymentTimingInfo() {
  const { t } = useTranslation();

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-primary" />
          {t('paymentTiming.title')}
        </CardTitle>
        <CardDescription>{t('paymentTiming.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">{t('paymentTiming.standardDelay')}</p>
              <p className="text-sm text-muted-foreground">{t('paymentTiming.standardDelayDesc')}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">{t('paymentTiming.firstPayment')}</p>
              <p className="text-sm text-muted-foreground">{t('paymentTiming.firstPaymentDesc')}</p>
            </div>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">{t('paymentTiming.businessDays')}:</strong>{' '}
              {t('paymentTiming.businessDaysDesc')}
            </p>
          </div>
          
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground">
              {t('paymentTiming.process')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
