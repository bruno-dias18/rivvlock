import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProfile } from '@/hooks/useProfile';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: profile, isLoading, error } = useProfile();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('navigation.profile')}</h1>
          <p className="text-muted-foreground">
            {t('user.profile')} - Gérez vos informations personnelles
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-60" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('navigation.profile')}</h1>
          <p className="text-muted-foreground text-red-500">
            Erreur lors du chargement du profil
          </p>
        </div>
      </div>
    );
  }

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
              <label className="text-sm font-medium">Type d'utilisateur</label>
              <div className="mt-1">
                <Badge variant="outline">
                  {profile?.user_type === 'individual' ? 'Particulier' : 'Entreprise'}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Pays</label>
              <div className="mt-1">
                <Badge variant="secondary">{profile?.country}</Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Statut de vérification</label>
              <div className="mt-1">
                <Badge variant={profile?.verified ? "default" : "destructive"}>
                  {profile?.verified ? 'Vérifié' : 'Non vérifié'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informations personnelles</CardTitle>
            <CardDescription>
              Vos données personnelles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('user.firstName')}</label>
              <p className="text-sm text-muted-foreground">
                {profile?.first_name || 'Non renseigné'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">{t('user.lastName')}</label>
              <p className="text-sm text-muted-foreground">
                {profile?.last_name || 'Non renseigné'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">{t('common.phone')}</label>
              <p className="text-sm text-muted-foreground">
                {profile?.phone || 'Non renseigné'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Adresse</label>
              <p className="text-sm text-muted-foreground">
                {profile?.address || 'Non renseignée'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Code postal</label>
              <p className="text-sm text-muted-foreground">
                {profile?.postal_code || 'Non renseigné'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Ville</label>
              <p className="text-sm text-muted-foreground">
                {profile?.city || 'Non renseignée'}
              </p>
            </div>
            {profile?.country === 'CH' && (
              <div>
                <label className="text-sm font-medium">Numéro AVS</label>
                <p className="text-sm text-muted-foreground">
                  {profile?.avs_number || 'Non renseigné'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {profile?.user_type === 'company' && (
          <Card>
            <CardHeader>
              <CardTitle>Informations d'entreprise</CardTitle>
              <CardDescription>
                Données de votre entreprise
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t('user.companyName')}</label>
                <p className="text-sm text-muted-foreground">
                  {profile?.company_name || 'Non renseigné'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">SIRET/UID</label>
                <p className="text-sm text-muted-foreground">
                  {profile?.siret_uid || 'Non renseigné'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Adresse de l'entreprise</label>
                <p className="text-sm text-muted-foreground">
                  {profile?.company_address || 'Non renseignée'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Taux TVA (%)</label>
                <p className="text-sm text-muted-foreground">
                  {profile?.tva_rate || 'Non renseigné'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Taux VAT (%)</label>
                <p className="text-sm text-muted-foreground">
                  {profile?.vat_rate || 'Non renseigné'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Paramètres du compte</CardTitle>
            <CardDescription>
              Configuration de votre compte
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Inscription complète</label>
              <div className="mt-1">
                <Badge variant={profile?.registration_complete ? "default" : "secondary"}>
                  {profile?.registration_complete ? 'Complète' : 'Incomplète'}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Conditions acceptées</label>
              <div className="mt-1">
                <Badge variant={profile?.acceptance_terms ? "default" : "destructive"}>
                  {profile?.acceptance_terms ? 'Acceptées' : 'Non acceptées'}
                </Badge>
              </div>
            </div>
            {profile?.stripe_customer_id && (
              <div>
                <label className="text-sm font-medium">Client Stripe</label>
                <p className="text-sm text-muted-foreground">Configuré</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}