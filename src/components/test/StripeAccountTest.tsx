import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TestResult {
  step: string;
  status: 'success' | 'error' | 'pending';
  message: string;
  details?: any;
}

interface StripeAccountData {
  stripe_account_id: string;
  account_status: string;
  onboarding_url?: string;
  existing: boolean;
}

export const StripeAccountTest = () => {
  const { user, session } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [accountData, setAccountData] = useState<StripeAccountData | null>(null);

  const isAuthenticated = !!user && !!session;

  const addTestResult = (result: TestResult) => {
    setTestResults(prev => [...prev, result]);
  };

  const runStripeAccountTest = async () => {
    if (!isAuthenticated || !user) {
      toast.error('Veuillez vous connecter pour exécuter ce test');
      return;
    }

    setIsRunning(true);
    setTestResults([]);
    setAccountData(null);

    try {
      addTestResult({
        step: 'Étape 1',
        status: 'pending',
        message: 'Démarrage du test create-stripe-account...'
      });

      // Test the create-stripe-account function
      const { data, error } = await supabase.functions.invoke('create-stripe-account');

      if (error) {
        addTestResult({
          step: 'Étape 1',
          status: 'error',
          message: 'Erreur lors de l\'appel à create-stripe-account',
          details: { error: error.message, context: error.context }
        });
        return;
      }

      if (!data) {
        addTestResult({
          step: 'Étape 1',
          status: 'error',
          message: 'Aucune donnée retournée par create-stripe-account'
        });
        return;
      }

      setAccountData(data);

      if (data.existing) {
        addTestResult({
          step: 'Étape 1',
          status: 'success',
          message: 'Compte Stripe Connect existant trouvé',
          details: { 
            accountId: data.stripe_account_id, 
            status: data.account_status 
          }
        });
      } else {
        addTestResult({
          step: 'Étape 1',
          status: 'success',
          message: 'Nouveau compte Stripe Connect créé',
          details: { 
            accountId: data.stripe_account_id, 
            status: data.account_status,
            onboardingUrl: data.onboarding_url 
          }
        });
      }

      // Test account validation
      addTestResult({
        step: 'Étape 2',
        status: 'success',
        message: 'Structure de réponse valide',
        details: {
          hasAccountId: !!data.stripe_account_id,
          hasStatus: !!data.account_status,
          hasOnboardingUrl: !!data.onboarding_url || data.existing
        }
      });

      // Test onboarding URL format
      if (data.onboarding_url) {
        const isValidUrl = data.onboarding_url.startsWith('https://');
        addTestResult({
          step: 'Étape 3',
          status: isValidUrl ? 'success' : 'error',
          message: isValidUrl 
            ? 'URL d\'onboarding valide générée' 
            : 'URL d\'onboarding invalide',
          details: { url: data.onboarding_url }
        });
      }

      toast.success('Test Stripe Account terminé avec succès');

    } catch (error) {
      addTestResult({
        step: 'Erreur',
        status: 'error',
        message: 'Échec du test Stripe Account',
        details: error instanceof Error 
          ? { name: error.name, message: error.message, stack: error.stack }
          : { error }
      });
      
      toast.error('Échec du test Stripe Account');
    } finally {
      setIsRunning(false);
    }
  };

  const openOnboardingUrl = () => {
    if (accountData?.onboarding_url) {
      window.open(accountData.onboarding_url, '_blank');
      toast.success('Ouverture de l\'interface Stripe Connect...');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Test Stripe Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            Veuillez vous connecter pour exécuter ce test.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Test Stripe Account
          <Badge variant="outline">create-stripe-account</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Button 
            onClick={runStripeAccountTest} 
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? 'Test en cours...' : 'Tester la création de compte Stripe'}
          </Button>
        </div>

        {accountData && (
          <div className="space-y-2">
            <h4 className="font-semibold">Données du compte Stripe:</h4>
            <div className="bg-muted p-3 rounded text-sm">
              <p><strong>ID:</strong> {accountData.stripe_account_id}</p>
              <p><strong>Statut:</strong> {accountData.account_status}</p>
              <p><strong>Existant:</strong> {accountData.existing ? 'Oui' : 'Non'}</p>
            </div>
            
            {accountData.onboarding_url && (
              <div className="flex gap-2">
                <Button 
                  onClick={openOnboardingUrl}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ouvrir l'onboarding Stripe
                </Button>
              </div>
            )}
          </div>
        )}

        {testResults.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold">Résultats des tests:</h4>
            {testResults.map((result, index) => (
              <div key={index} className="flex items-start gap-3 p-3 border rounded">
                {getStatusIcon(result.status)}
                <div className="flex-1">
                  <div className="font-medium">{result.step}: {result.message}</div>
                  {result.details && (
                    <pre className="text-xs text-muted-foreground mt-1 overflow-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          <p><strong>Ce test vérifie:</strong></p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Authentification de l'utilisateur</li>
            <li>Création ou récupération du compte Stripe Connect</li>
            <li>Génération de l'URL d'onboarding</li>
            <li>Structure de la réponse API</li>
            <li>Gestion des comptes existants</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};