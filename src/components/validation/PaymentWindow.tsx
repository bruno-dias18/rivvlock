import { useState, useEffect } from 'react';
import { differenceInDays, differenceInHours, format, isAfter, isBefore } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CountdownTimer } from '@/components/dashboard/CountdownTimer';
import { PaymentMethods } from '@/components/payment/PaymentMethods';
import { 
  CreditCard, 
  Smartphone, 
  QrCode, 
  ExternalLink, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Users,
  Building2,
  Lock
} from 'lucide-react';

interface PaymentWindowProps {
  transaction: {
    id: string;
    title: string;
    price: number;
    currency: string;
    service_date: string;
    payment_deadline?: string;
    status: string;
  };
  onPaymentSuccess?: () => void;
}

export const PaymentWindow = ({ transaction, onPaymentSuccess }: PaymentWindowProps) => {
  const [windowStatus, setWindowStatus] = useState<'open' | 'closing' | 'closed'>('closed');
  const [showUrgentAlert, setShowUrgentAlert] = useState(false);

  useEffect(() => {
    const checkPaymentWindow = () => {
      const serviceDate = new Date(transaction.service_date);
      const paymentDeadline = transaction.payment_deadline ? 
        new Date(transaction.payment_deadline) : 
        new Date(serviceDate.getTime() - 24 * 60 * 60 * 1000); // Day before service date

      const now = new Date();
      
      // Window opens 7 days before payment deadline
      const windowOpenDate = new Date(paymentDeadline.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      if (isAfter(now, paymentDeadline)) {
        setWindowStatus('closed');
      } else if (isAfter(now, windowOpenDate)) {
        setWindowStatus('open');
        
        // Show urgent alert if less than 24 hours remaining
        const hoursRemaining = differenceInHours(paymentDeadline, now);
        if (hoursRemaining <= 24) {
          setShowUrgentAlert(true);
        }
      } else {
        setWindowStatus('closed');
      }
    };

    checkPaymentWindow();
    const interval = setInterval(checkPaymentWindow, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [transaction.service_date, transaction.payment_deadline]);

  const getWindowInfo = () => {
    const serviceDate = new Date(transaction.service_date);
    const paymentDeadline = transaction.payment_deadline ? 
      new Date(transaction.payment_deadline) : 
      new Date(serviceDate.getTime() - 24 * 60 * 60 * 1000);

    const windowOpenDate = new Date(paymentDeadline.getTime() - 7 * 24 * 60 * 60 * 1000);

    return {
      serviceDate,
      paymentDeadline,
      windowOpenDate,
      serviceDateFormatted: format(serviceDate, 'PPP à HH:mm', { locale: fr }),
      paymentDeadlineFormatted: format(paymentDeadline, 'PPP à HH:mm', { locale: fr }),
      windowOpenFormatted: format(windowOpenDate, 'PPP à HH:mm', { locale: fr })
    };
  };

  const windowInfo = getWindowInfo();

  if (transaction.status === 'paid') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            Paiement effectué
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Le paiement a été effectué avec succès. Les fonds sont bloqués en escrow jusqu'à validation mutuelle.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (windowStatus === 'closed') {
    const now = new Date();
    
    if (isAfter(now, windowInfo.paymentDeadline)) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Fenêtre de paiement fermée
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                La fenêtre de paiement s'est fermée le {windowInfo.paymentDeadlineFormatted}.
                Cette transaction est expirée.
              </AlertDescription>
            </Alert>
            
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Service prévu:</strong> {windowInfo.serviceDateFormatted}</p>
                <p><strong>Paiement requis avant:</strong> {windowInfo.paymentDeadlineFormatted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Fenêtre de paiement pas encore ouverte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              La fenêtre de paiement ouvrira le {windowInfo.windowOpenFormatted}
              <br />
              <span className="text-sm">
                Paiement possible jusqu'au {windowInfo.paymentDeadlineFormatted}
              </span>
            </AlertDescription>
          </Alert>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="text-sm space-y-2">
              <p><strong>📅 Calendrier de paiement:</strong></p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Ouverture: {windowInfo.windowOpenFormatted}</li>
                <li>• Limite: {windowInfo.paymentDeadlineFormatted}</li>
                <li>• Service: {windowInfo.serviceDateFormatted}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-green-600" />
          Fenêtre de paiement ouverte
        </CardTitle>
        <CardDescription>
          Vous pouvez maintenant effectuer le paiement pour bloquer les fonds
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {showUrgentAlert && (
          <Alert className="border-red-200 bg-red-50 animate-pulse">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>⚠️ URGENT !</strong> Moins de 24h pour effectuer le paiement !
            </AlertDescription>
          </Alert>
        )}

        <CountdownTimer
          targetDate={windowInfo.paymentDeadline.toISOString()}
          label="Paiement requis avant"
          showAlert={true}
          onExpired={() => setWindowStatus('closed')}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Service prévu:</strong>
            <p className="text-muted-foreground">{windowInfo.serviceDateFormatted}</p>
          </div>
          <div>
            <strong>Limite paiement:</strong>
            <p className="text-muted-foreground">{windowInfo.paymentDeadlineFormatted}</p>
          </div>
        </div>

        <PaymentMethods
          amount={transaction.price}
          currency={transaction.currency}
          onPaymentSuccess={onPaymentSuccess}
        />

        <div className="text-center text-xs text-muted-foreground">
          <p>🔒 Les fonds seront bloqués de manière sécurisée jusqu'à validation mutuelle du travail.</p>
          <p>⚡ Aucun prélèvement tant que les deux parties ne valident pas.</p>
        </div>
      </CardContent>
    </Card>
  );
};