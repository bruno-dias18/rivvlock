import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('navigation.profile')}</h1>
        <p className="text-muted-foreground">
          {t('user.profile')} - Gérez vos informations personnelles
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Informations du compte</CardTitle>
            <CardDescription>
              Vos informations de base
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('common.email')}</label>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <div className="mt-1">
                <Badge variant="secondary">Actif</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informations de profil</CardTitle>
            <CardDescription>
              Complétez votre profil
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('user.firstName')}</label>
              <p className="text-sm text-muted-foreground">À compléter</p>
            </div>
            <div>
              <label className="text-sm font-medium">{t('user.lastName')}</label>
              <p className="text-sm text-muted-foreground">À compléter</p>
            </div>
            <div>
              <label className="text-sm font-medium">{t('common.phone')}</label>
              <p className="text-sm text-muted-foreground">À compléter</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sécurité</CardTitle>
            <CardDescription>
              Paramètres de sécurité du compte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Fonctionnalités de sécurité à implémenter
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Préférences</CardTitle>
            <CardDescription>
              Personnalisez votre expérience
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Paramètres à implémenter
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}