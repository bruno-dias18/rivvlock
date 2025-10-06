import { useState, useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const OpenInAppBanner = () => {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if we're on iOS
    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    
    // Check if we're already in standalone mode (PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone;
    
    // Check if banner was dismissed
    const dismissed = sessionStorage.getItem('open-in-app-dismissed') === 'true';
    
    // Only show on iOS, not in standalone mode, and not dismissed
    if (isIOS && !isStandalone && !dismissed) {
      setShowBanner(true);
    }
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem('open-in-app-dismissed', 'true');
    setShowBanner(false);
  };

  const handleOpenInApp = () => {
    // Get current URL to preserve the path
    const currentUrl = window.location.href;
    
    // Try to open in PWA - if installed, this will work
    window.location.href = currentUrl;
    
    // Dismiss banner after attempt
    handleDismiss();
  };

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground shadow-lg">
      <div className="flex items-center justify-between p-3 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 flex-1">
          <ExternalLink className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">Ouvrir dans l'app RIVVLOCK</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenInApp}
            className="text-xs"
          >
            Ouvrir
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
