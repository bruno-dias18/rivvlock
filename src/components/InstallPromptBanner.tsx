import { X, Download, Share, Smartphone } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useIsMobile } from '@/lib/mobileUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const InstallPromptBanner = () => {
  const isMobile = useIsMobile();
  const { shouldShowPrompt, isIOS, canInstall, installApp, dismissPrompt } = useInstallPrompt();

  if (!isMobile || !shouldShowPrompt) return null;

  return (
    <Card className="w-full border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 relative">
      <button
        onClick={dismissPrompt}
        className="absolute top-3 right-3 p-1 hover:bg-accent rounded-sm transition-colors"
        aria-label="Fermer"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
      
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">
              Installer l'application
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Accès rapide depuis votre écran d'accueil
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-3">
        {isIOS ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Pour installer l'application :
            </p>
            <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li className="flex items-start gap-2">
                <Share className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                <span>Appuyez sur le bouton de partage</span>
              </li>
              <li>Sélectionnez "Sur l'écran d'accueil"</li>
              <li>Appuyez sur "Ajouter"</li>
            </ol>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Installez l'application pour un accès rapide et une meilleure expérience.
            </p>
            {canInstall && (
              <Button
                onClick={installApp}
                className="w-full"
                size="lg"
              >
                <Download className="w-4 h-4 mr-2" />
                Installer maintenant
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
