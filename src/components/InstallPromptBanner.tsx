import { X, Download, Share } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useIsMobile } from '@/lib/mobileUtils';
import { Button } from '@/components/ui/button';

export const InstallPromptBanner = () => {
  const isMobile = useIsMobile();
  const { shouldShowPrompt, isIOS, canInstall, installApp, dismissPrompt } = useInstallPrompt();

  if (!isMobile || !shouldShowPrompt) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-primary/10 backdrop-blur-sm border-b border-primary/20 animate-in slide-in-from-top duration-300">
      <div className="flex items-center justify-between gap-2 px-4 py-2 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isIOS ? (
            <>
              <Share className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm text-foreground truncate">
                Ajouter à l'écran d'accueil
              </span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm text-foreground truncate">
                Installer l'application
              </span>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isIOS && canInstall && (
            <Button
              size="sm"
              variant="default"
              onClick={installApp}
              className="h-7 px-3 text-xs"
            >
              Installer
            </Button>
          )}
          
          <button
            onClick={dismissPrompt}
            className="p-1 hover:bg-accent rounded-sm transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};
