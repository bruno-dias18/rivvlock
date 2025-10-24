import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const PushNotificationPrompt = () => {
  const { permission, isSupported, requestPermission } = usePushNotifications();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Vérifier si déjà demandé ou refusé
    const dismissed = localStorage.getItem('push-notification-dismissed') === 'true';
    setIsDismissed(dismissed);

    // Afficher le prompt après 30 secondes si pas encore demandé
    if (isSupported && permission === 'default' && !dismissed) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 30000); // 30 secondes

      return () => clearTimeout(timer);
    }
  }, [isSupported, permission]);

  const handleEnable = async () => {
    const granted = await requestPermission();
    if (granted) {
      setShowPrompt(false);
      localStorage.setItem('push-notification-dismissed', 'true');
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setIsDismissed(true);
    localStorage.setItem('push-notification-dismissed', 'true');
  };

  // Ne rien afficher si pas supporté, déjà accordé, refusé, ou dismissed
  if (!isSupported || permission !== 'default' || isDismissed || !showPrompt) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-[350px] shadow-2xl border-primary/20 bg-card/95 backdrop-blur-sm">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 hover:bg-accent rounded-sm transition-colors"
        aria-label="Fermer"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
      
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">
              Activer les notifications
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Soyez alerté instantanément
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-3">
        <ul className="text-sm text-muted-foreground space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>Paiements reçus</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>Nouveaux messages</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>Mises à jour importantes</span>
          </li>
        </ul>
        
        <div className="flex gap-2">
          <Button
            onClick={handleEnable}
            className="flex-1"
            size="sm"
          >
            Activer
          </Button>
          <Button
            onClick={handleDismiss}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            Plus tard
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
