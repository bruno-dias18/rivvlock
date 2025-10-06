import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Mail, CheckCircle } from 'lucide-react';

export default function RegistrationSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="mb-8">
          <img 
            src="/assets/rivvlock-logo.jpeg" 
            alt="RIVVLOCK Logo" 
            className="mx-auto h-24 w-auto object-contain"
          />
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-8 space-y-6">
          <div className="flex justify-center">
            <CheckCircle className="h-20 w-20 text-green-600 dark:text-green-400" />
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-green-800 dark:text-green-400">
              ✅ Compte créé avec succès !
            </h1>
            
            <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-300">
              <Mail className="h-5 w-5" />
              <p className="text-sm font-medium">
                Email de confirmation envoyé
              </p>
            </div>

            {email && (
              <p className="text-sm text-green-700 dark:text-green-300 font-mono bg-green-100 dark:bg-green-900/30 rounded px-3 py-2">
                {email}
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-md p-4 space-y-3 border border-green-200 dark:border-green-700">
            <p className="text-sm text-foreground font-semibold">
              📧 Prochaines étapes :
            </p>
            <ol className="text-left text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Vérifiez votre boîte de réception</li>
              <li>Cliquez sur le lien de validation dans l'email</li>
              <li>Connectez-vous avec vos identifiants</li>
            </ol>
          </div>

          <div className="pt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Vous n'avez pas reçu l'email ? Vérifiez vos spams ou contactez le support.
            </p>
            
            <Button
              onClick={() => navigate('/auth')}
              variant="outline"
              className="w-full"
            >
              Retour à la connexion
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
