import { useState, useEffect } from 'react';
import { X, ExternalLink, Download, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const OpenInAppBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);

  useEffect(() => {
    // Check if we're on iOS
    const iOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    setIsIOS(iOS);
    
    // Check if we're already in standalone mode (PWA installed and opened from home screen)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone;
    
    // Check if banner was dismissed
    const dismissed = sessionStorage.getItem('open-in-app-dismissed') === 'true';
    
    // Try to detect if PWA is likely installed (not 100% reliable on iOS)
    // If user has visited before in standalone mode, we assume it's installed
    const wasInStandalone = localStorage.getItem('was-standalone') === 'true';
    setIsPWAInstalled(wasInStandalone);
    
    // Save that we're in standalone mode for future detection
    if (isStandalone) {
      localStorage.setItem('was-standalone', 'true');
    }
    
    // Only show on iOS, not in standalone mode, and not dismissed
    if (iOS && !isStandalone && !dismissed) {
      setShowBanner(true);
    }
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem('open-in-app-dismissed', 'true');
    setShowBanner(false);
  };

  const handleAction = () => {
    if (isPWAInstalled) {
      // If PWA seems installed, try to open it
      window.location.href = window.location.href;
    }
    // If not installed, the instructions below will guide the user
    handleDismiss();
  };

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground shadow-lg">
      <div className="flex items-center justify-between p-3 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 flex-1">
          {isPWAInstalled ? (
            <ExternalLink className="h-5 w-5 flex-shrink-0" />
          ) : (
            <Download className="h-5 w-5 flex-shrink-0" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium">
              {isPWAInstalled ? 'Ouvrir dans l\'app RIVVLOCK' : 'Installer l\'app RIVVLOCK'}
            </p>
            {!isPWAInstalled && isIOS && (
              <p className="text-xs opacity-90 mt-1">
                Appuyez sur <Share className="inline h-3 w-3 mx-1" /> puis "Sur l'écran d'accueil"
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAction}
            className="text-xs whitespace-nowrap"
          >
            {isPWAInstalled ? 'Ouvrir' : 'OK'}
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
