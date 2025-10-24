import { Smartphone, Zap, Shield, Download, CheckCircle2 } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function InstallPage() {
  const { canInstall, installApp, isIOS, isAndroid } = useInstallPrompt();

  const handleInstall = async () => {
    if (canInstall) {
      await installApp();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/10 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
              <Smartphone className="w-16 h-16 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            Installez RIVVLOCK
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Accédez instantanément à vos transactions depuis votre écran d'accueil
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <Zap className="w-8 h-8 text-primary mb-2" />
              <CardTitle className="text-lg">Ultra Rapide</CardTitle>
              <CardDescription>
                Chargement instantané et performances optimales
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Shield className="w-8 h-8 text-primary mb-2" />
              <CardTitle className="text-lg">Sécurisé</CardTitle>
              <CardDescription>
                Vos données protégées avec le chiffrement de bout en bout
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CheckCircle2 className="w-8 h-8 text-primary mb-2" />
              <CardTitle className="text-lg">Hors Ligne</CardTitle>
              <CardDescription>
                Consultez vos transactions même sans connexion
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Install Instructions */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle>Comment installer l'application ?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isIOS && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-primary" />
                  Sur iPhone/iPad
                </h3>
                <ol className="space-y-3 list-decimal list-inside text-muted-foreground">
                  <li>Ouvrez RIVVLOCK dans Safari</li>
                  <li>Appuyez sur le bouton de partage (icône carré avec flèche)</li>
                  <li>Faites défiler et sélectionnez "Sur l'écran d'accueil"</li>
                  <li>Appuyez sur "Ajouter" en haut à droite</li>
                </ol>
              </div>
            )}

            {isAndroid && canInstall && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-primary" />
                  Sur Android
                </h3>
                <p className="text-muted-foreground">
                  Cliquez sur le bouton ci-dessous pour installer l'application instantanément
                </p>
                <Button 
                  onClick={handleInstall}
                  size="lg"
                  className="w-full"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Installer l'application
                </Button>
              </div>
            )}

            {!isIOS && !isAndroid && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Sur ordinateur</h3>
                <p className="text-muted-foreground">
                  L'application est optimisée pour mobile. Scannez ce QR code avec votre téléphone pour installer.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Benefits */}
        <Card>
          <CardHeader>
            <CardTitle>Pourquoi installer l'application ?</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {[
                "Accès instantané depuis votre écran d'accueil",
                "Fonctionne hors ligne pour consulter vos transactions",
                "Reçoit des notifications pour vos paiements importants",
                "Utilise moins de données et de batterie",
                "Expérience fluide comme une vraie application",
              ].map((benefit, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{benefit}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
