import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/hooks/useProfile';
import { Skeleton } from '@/components/ui/skeleton';
import { EditProfileDialog } from '@/components/EditProfileDialog';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';
import BankAccountSetupCard from '@/components/BankAccountSetupCard';
import { Edit, Trash2, FileText, Mail, ExternalLink, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/DashboardLayout';
import { DeleteAccountDialog } from '@/components/DeleteAccountDialog';
import { ProfileAccessLogsCard } from '@/components/ProfileAccessLogsCard';
import { SellerTransactionsCountdownCard } from '@/components/SellerTransactionsCountdownCard';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: profile, isLoading, error, refetch } = useProfile();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const queryClient = useQueryClient();

  const handleExportData = async () => {
    setIsExportingData(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-user-data');
      
      if (error) throw error;
      
      // Create downloadable file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rivvlock-donnees-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(t('profile.dataExported'));
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('profile.exportError'));
    } finally {
      setIsExportingData(false);
    }
  };

  // Détecter le retour de Stripe et rafraîchir automatiquement
  useEffect(() => {
    // Rafraîchir les données Stripe au chargement de la page
    // Cela permet de voir les mises à jour après le retour de Stripe
    queryClient.invalidateQueries({ queryKey: ['stripe-account'] });
    refetch();
  }, [queryClient, refetch]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('navigation.profile')}</h1>
          <p className="text-muted-foreground">
            {t('user.profile')} - {t('profile.managePersonalInfo')}
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
            {t('profile.loadingError')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('navigation.profile')}</h1>
          <p className="text-muted-foreground">
            {t('user.profile')} - {t('profile.managePersonalInfo')}
          </p>
        </div>
        <Button
          onClick={() => setIsEditDialogOpen(true)}
          className="flex items-center gap-2"
        >
          <Edit className="h-4 w-4" />
          {t('profile.editProfile')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('profile.accountInfo')}</CardTitle>
            <CardDescription>
              {t('profile.basicInfo')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('common.email')}</label>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium">{t('profile.userType')}</label>
              <div className="mt-1">
                <Badge variant="outline">
                  {profile?.user_type === 'individual' ? t('user.individual') : t('user.company')}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{t('common.country')}</label>
              <div className="mt-1">
                <Badge variant="secondary">{profile?.country}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('profile.personalInfo')}</CardTitle>
            <CardDescription>
              {t('profile.personalData')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('user.firstName')}</label>
              <p className="text-sm text-muted-foreground">
                {profile?.first_name || t('profile.notProvided')}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">{t('user.lastName')}</label>
              <p className="text-sm text-muted-foreground">
                {profile?.last_name || t('profile.notProvided')}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">{t('common.phone')}</label>
              <p className="text-sm text-muted-foreground">
                {profile?.phone || t('profile.notProvided')}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">{t('common.address')}</label>
              <p className="text-sm text-muted-foreground">
                {profile?.address || t('profile.notProvidedFeminine')}
              </p>
            </div>
            {profile?.user_type !== 'company' && (
              <>
                <div>
                  <label className="text-sm font-medium">{t('common.postalCode')}</label>
                  <p className="text-sm text-muted-foreground">
                    {profile?.postal_code || t('profile.notProvided')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">{t('common.city')}</label>
                  <p className="text-sm text-muted-foreground">
                    {profile?.city || t('profile.notProvidedFeminine')}
                  </p>
                </div>
              </>
            )}
            {profile?.country === 'CH' && profile?.user_type !== 'company' && (
              <div>
                <label className="text-sm font-medium">{t('user.avs')}</label>
                <p className="text-sm text-muted-foreground">
                  {profile?.avs_number || t('profile.notProvided')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {profile?.user_type === 'company' && (
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.companyInfo')}</CardTitle>
              <CardDescription>
                {t('profile.companyData')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t('user.companyName')}</label>
                <p className="text-sm text-muted-foreground">
                  {profile?.company_name || t('profile.notProvided')}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">SIRET/UID</label>
                <p className="text-sm text-muted-foreground">
                  {profile?.siret_uid || t('profile.notProvided')}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">{t('profile.companyAddress')}</label>
                <p className="text-sm text-muted-foreground">
                  {profile?.company_address || t('profile.notProvidedFeminine')}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">{t('profile.headOfficePostalCode')}</label>
                <p className="text-sm text-muted-foreground">
                  {profile?.postal_code || t('profile.notProvided')}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">{t('profile.headOfficeCity')}</label>
                <p className="text-sm text-muted-foreground">
                  {profile?.city || t('profile.notProvidedFeminine')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {(profile?.user_type === 'company' || profile?.user_type === 'independent') && (
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.taxInfo')}</CardTitle>
              <CardDescription>
                {t('profile.vatInfo')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t('profile.subjectToVat')}</label>
                <div className="mt-1">
                  <Badge variant={profile?.is_subject_to_vat ? "default" : "secondary"}>
                    {profile?.is_subject_to_vat ? t('status.yes') : t('status.no')}
                  </Badge>
                </div>
              </div>
              {profile?.is_subject_to_vat && (
                <>
                  <div>
                    <label className="text-sm font-medium">{t('user.vat')}</label>
                    <p className="text-sm text-muted-foreground">
                      {profile?.vat_number || t('profile.notProvided')}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      {t('profile.vatRate')}
                    </label>
                    <p className="text-sm text-muted-foreground">
                      {profile?.country === 'FR' 
                        ? (profile?.tva_rate || t('profile.notProvided'))
                        : (profile?.vat_rate || t('profile.notProvided'))
                      }
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t('profile.accountSettings')}</CardTitle>
            <CardDescription>
              {t('profile.accountConfiguration')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('profile.registrationComplete')}</label>
              <div className="mt-1">
                <Badge variant={profile?.registration_complete ? "default" : "secondary"}>
                  {profile?.registration_complete ? t('profile.complete') : t('profile.incomplete')}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{t('profile.termsAccepted')}</label>
              <div className="mt-1">
                <Badge variant={profile?.acceptance_terms ? "default" : "destructive"}>
                  {profile?.acceptance_terms ? t('profile.accepted') : t('profile.notAccepted')}
                </Badge>
              </div>
            </div>
            {profile?.stripe_customer_id && (
              <div>
                <label className="text-sm font-medium">{t('profile.stripeCustomer')}</label>
                <p className="text-sm text-muted-foreground">{t('profile.configured')}</p>
              </div>
            )}
            <div className="pt-4">
              <Button
                variant="outline"
                onClick={() => setIsChangePasswordOpen(true)}
                className="w-full"
              >
                {t('profile.changePassword')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('profile.dataPrivacy')}</CardTitle>
            <CardDescription>
              {t('profile.dataPrivacyDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/privacy">
              <Button variant="ghost" className="w-full justify-start h-auto p-3">
                <FileText className="h-4 w-4 mr-3" />
                <span>{t('profile.privacyPolicy')}</span>
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              className="w-full justify-start h-auto p-3"
              onClick={handleExportData}
              disabled={isExportingData}
            >
              <Download className="h-4 w-4 mr-3" />
              <span>{isExportingData ? t('profile.exporting') : t('profile.exportMyData')}</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start h-auto p-3 text-destructive hover:text-destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-3" />
              <span>{t('profile.deleteAccount')}</span>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('profile.helpSupport')}</CardTitle>
            <CardDescription>
              {t('profile.helpDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/terms">
              <Button variant="ghost" className="w-full justify-start h-auto p-3">
                <FileText className="h-4 w-4 mr-3" />
                <span>{t('profile.termsOfService')}</span>
              </Button>
            </Link>
            <a href="mailto:contact@rivvlock.com">
              <Button variant="ghost" className="w-full justify-start h-auto p-3">
                <Mail className="h-4 w-4 mr-3" />
                <span>{t('profile.contactUs')}</span>
              </Button>
            </a>
            <a href="https://rivvlock.com" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" className="w-full justify-start h-auto p-3">
                <ExternalLink className="h-4 w-4 mr-3" />
                <span>{t('profile.website')}</span>
              </Button>
            </a>
          </CardContent>
        </Card>

        <BankAccountSetupCard />

        <SellerTransactionsCountdownCard />

        <ProfileAccessLogsCard />

      </div>

      <EditProfileDialog 
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        profile={profile}
        onProfileUpdated={() => refetch()}
        onDeleteAccount={() => setIsDeleteDialogOpen(true)}
      />

      <ChangePasswordDialog 
        open={isChangePasswordOpen}
        onOpenChange={setIsChangePasswordOpen}
      />

      <DeleteAccountDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      />
      </div>
    </DashboardLayout>
  );
}