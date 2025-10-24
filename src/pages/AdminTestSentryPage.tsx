import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Bug, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { captureException, addBreadcrumb } from '@/lib/sentry';
import { toast } from 'sonner';
import { DashboardLayoutWithSidebar } from '@/components/layouts/DashboardLayoutWithSidebar';

/**
 * Page de test Sentry (Admin uniquement)
 * Permet de tester différents types d'erreurs pour vérifier le monitoring
 */
export default function AdminTestSentryPage() {
  const [lastError, setLastError] = useState<string | null>(null);

  const testSimpleError = () => {
    try {
      addBreadcrumb({
        category: 'test',
        message: 'User clicked "Test Simple Error" button',
        level: 'info',
      });
      
      throw new Error('🧪 Test Sentry: Simple error from admin panel');
    } catch (error) {
      captureException(error as Error, { tags: { test_type: 'simple' } });
      setLastError('Simple error sent to Sentry ✅');
      toast.success('Error sent to Sentry');
    }
  };

  const testAsyncError = async () => {
    try {
      addBreadcrumb({
        category: 'test',
        message: 'User clicked "Test Async Error" button',
        level: 'info',
      });

      await new Promise((_, reject) => 
        setTimeout(() => reject(new Error('🧪 Test Sentry: Async error')), 100)
      );
    } catch (error) {
      captureException(error as Error, { tags: { test_type: 'async' } });
      setLastError('Async error sent to Sentry ✅');
      toast.success('Async error sent to Sentry');
    }
  };

  const testApiError = () => {
    try {
      addBreadcrumb({
        category: 'api',
        message: 'Simulating API failure',
        level: 'warning',
      });

      const fakeApiError = new Error('🧪 Test Sentry: Fake API call failed');
      (fakeApiError as any).status = 500;
      (fakeApiError as any).endpoint = '/api/fake-endpoint';
      
      throw fakeApiError;
    } catch (error) {
      captureException(error as Error, { 
        tags: { test_type: 'api_failure' },
        extra: { endpoint: '/api/fake-endpoint', status: 500 }
      });
      setLastError('API error sent to Sentry ✅');
      toast.success('API error sent to Sentry');
    }
  };

  const testUnhandledError = () => {
    addBreadcrumb({
      category: 'test',
      message: 'User triggered unhandled error',
      level: 'error',
    });

    // Cette erreur ne sera PAS catchée (test global error handler)
    setTimeout(() => {
      throw new Error('🧪 Test Sentry: Unhandled error (should be caught by global handler)');
    }, 100);

    setLastError('Unhandled error triggered (check console) ⚠️');
    toast.warning('Unhandled error triggered');
  };

  return (
    <DashboardLayoutWithSidebar>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Test Sentry Monitoring</h1>
          <p className="text-muted-foreground mt-2">
            Déclenchez différents types d'erreurs pour tester le monitoring production
          </p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Admin uniquement :</strong> Ces tests enverront de vraies erreurs à Sentry. 
            Utilisez uniquement en environnement de test ou pour vérifier la configuration.
          </AlertDescription>
        </Alert>

        {lastError && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-900 dark:text-green-100">
              {lastError}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* Test 1: Simple Error */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5" />
                Simple Error
              </CardTitle>
              <CardDescription>
                Erreur basique avec try/catch. Le type d'erreur le plus commun.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={testSimpleError} variant="outline" className="w-full">
                Déclencher erreur simple
              </Button>
            </CardContent>
          </Card>

          {/* Test 2: Async Error */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Async Error
              </CardTitle>
              <CardDescription>
                Erreur dans une Promise. Test des erreurs asynchrones.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={testAsyncError} variant="outline" className="w-full">
                Déclencher erreur async
              </Button>
            </CardContent>
          </Card>

          {/* Test 3: API Failure */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                API Failure
              </CardTitle>
              <CardDescription>
                Simule une erreur API avec status code et metadata.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={testApiError} variant="outline" className="w-full">
                Simuler échec API
              </Button>
            </CardContent>
          </Card>

          {/* Test 4: Unhandled Error */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Unhandled Error
              </CardTitle>
              <CardDescription>
                Erreur non-catchée. Test du global error handler.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={testUnhandledError} 
                variant="destructive" 
                className="w-full"
              >
                ⚠️ Déclencher erreur non-gérée
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <CardHeader>
            <CardTitle>Comment vérifier ?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>1. Cliquez sur un bouton ci-dessus</p>
            <p>2. Allez sur <strong>https://sentry.io/issues/</strong></p>
            <p>3. Vous devriez voir l'erreur apparaître en {"<"}1 minute</p>
            <p className="text-muted-foreground mt-4">
              💡 Astuce : Les erreurs incluent des tags pour identifier qu'elles viennent de cette page de test.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayoutWithSidebar>
  );
}
