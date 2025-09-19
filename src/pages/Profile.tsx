import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/hooks/useLanguage';
import { useCurrency } from '@/hooks/useCurrency';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  Building, 
  CreditCard,
  Settings,
  Shield,
  Loader2,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';

interface UserProfile {
  user_id: string;
  user_type: 'individual' | 'company' | 'independent';
  country: 'FR' | 'CH';
  verified: boolean;
  first_name?: string;
  last_name?: string;
  phone?: string;
  address?: string;
  company_name?: string;
  siret_uid?: string;
  company_address?: string;
  iban?: string;
  avs_number?: string;
  tva_rate?: number;
  vat_rate?: number;
  created_at: string;
}

export const Profile = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { languages, switchLanguage, currentLanguageInfo } = useLanguage();
  const { currencies, switchCurrency, currency } = useCurrency();
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching profile:', error);
          toast({
            variant: "destructive",
            title: "Erreur",
            description: "Impossible de charger le profil"
          });
          return;
        }

        setProfile(data);
      } catch (error) {
        console.error('Error:', error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Une erreur est survenue lors du chargement"
        });
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user, toast]);

  const handleSave = async () => {
    if (!profile || !user) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
          address: profile.address,
          company_name: profile.company_name,
          siret_uid: profile.siret_uid,
          company_address: profile.company_address,
          avs_number: profile.avs_number,
          tva_rate: profile.tva_rate,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Succès",
        description: "Profil mis à jour avec succès"
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre à jour le profil"
      });
    }
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    if (profile) {
      setProfile({ ...profile, ...updates });
    }
  };

  const getVATRate = (country: 'FR' | 'CH') => {
    return country === 'FR' ? '20%' : '8.1%';
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Chargement du profil...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-muted-foreground">Aucun profil trouvé</p>
            <Button onClick={() => navigate('/dashboard')} className="mt-4">
              Retour au tableau de bord
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Profile Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {t('user.profile')}
            </h1>
            <p className="text-muted-foreground mt-1">
              Gérez vos informations personnelles et fiscales
            </p>
          </div>
          <div className="flex items-center gap-2">
            {profile.verified && (
              <Badge className="bg-green-100 text-green-800">
                <Shield className="w-3 h-3 mr-1" />
                Vérifié
              </Badge>
            )}
            <Button
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              className={isEditing ? "gradient-success text-white" : ""}
            >
              {isEditing ? t('common.save') : t('common.edit')}
            </Button>
          </div>
        </div>

        {/* Security Warning */}
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Security Alert: Improve Password Protection</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Your account security could be improved. Leaked password protection is currently disabled, which means you can set passwords that have been compromised in data breaches.</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.open('https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Enable in Auth Settings
            </Button>
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Profile Information */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {profile.user_type === 'company' ? (
                    <Building className="w-5 h-5" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                  Informations {profile.user_type === 'company' ? 'Entreprise' : 
                    profile.user_type === 'independent' ? 'Indépendant' : 'Personnelles'}
                </CardTitle>
                <CardDescription>
                  Données fiscales et informations légales
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.user_type === 'company' ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="companyName">{t('user.companyName')}</Label>
                        <Input
                          id="companyName"
                          value={profile.company_name || ''}
                          onChange={(e) => updateProfile({ company_name: e.target.value })}
                          disabled={!isEditing}
                        />
                      </div>
                      <div>
                        <Label htmlFor="siret">
                          {profile.country === 'FR' ? t('user.siret') : t('user.uid')}
                        </Label>
                        <Input
                          id="siret"
                          value={profile.siret_uid || ''}
                          onChange={(e) => updateProfile({ siret_uid: e.target.value })}
                          disabled={!isEditing}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="headquarters">{t('user.headquarters')}</Label>
                      <Input
                        id="headquarters"
                        value={profile.company_address || ''}
                        onChange={(e) => updateProfile({ company_address: e.target.value })}
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>{t('user.vat')} ({getVATRate(profile.country)})</Label>
                        <Input disabled value={`${profile.vat_rate || getVATRate(profile.country)}`} />
                      </div>
                      <div>
                        <Alert className="border-primary bg-primary/5">
                          <Shield className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Banking via Stripe Connect</strong>
                            <p className="text-sm mt-1">Your banking information is securely managed through Stripe Connect for maximum security. No sensitive data is stored in our system.</p>
                          </AlertDescription>
                        </Alert>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">{t('user.firstName')}</Label>
                        <Input
                          id="firstName"
                          value={profile.first_name || ''}
                          onChange={(e) => updateProfile({ first_name: e.target.value })}
                          disabled={!isEditing}
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">{t('user.lastName')}</Label>
                        <Input
                          id="lastName"
                          value={profile.last_name || ''}
                          onChange={(e) => updateProfile({ last_name: e.target.value })}
                          disabled={!isEditing}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="address">{t('common.address')}</Label>
                      <Input
                        id="address"
                        value={profile.address || ''}
                        onChange={(e) => updateProfile({ address: e.target.value })}
                        disabled={!isEditing}
                      />
                    </div>
                  </>
                )}

                {/* Independent specific fields for Switzerland */}
                {profile.user_type === 'independent' && profile.country === 'CH' && (
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium text-sm text-muted-foreground">Informations spécifiques - Indépendant (CH)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="avs">{t('user.avsOptional')}</Label>
                        <Input
                          id="avs"
                          value={profile.avs_number || ''}
                          onChange={(e) => updateProfile({ avs_number: e.target.value })}
                          disabled={!isEditing}
                          placeholder="756.1234.5678.90"
                        />
                      </div>
                      <div>
                        <Label htmlFor="tvaRate">{t('user.vatOptional')} (8.1%)</Label>
                        <Input
                          id="tvaRate"
                          type="number"
                          step="0.1"
                          value={profile.tva_rate || ''}
                          onChange={(e) => updateProfile({ tva_rate: parseFloat(e.target.value) || undefined })}
                          disabled={!isEditing}
                          placeholder="8.1"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">{t('common.email')}</Label>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                    <Input
                        id="email"
                        value={user?.email || ''}
                        disabled={true}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="phone">{t('common.phone')}</Label>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        value={profile.phone || ''}
                        onChange={(e) => updateProfile({ phone: e.target.value })}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Settings Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  {t('dashboard.settings')}
                </CardTitle>
                <CardDescription>
                  Préférences de langue et devise
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t('common.language')}</Label>
                  <Select
                    value={currentLanguageInfo.code}
                    onValueChange={(value) => switchLanguage(value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.flag} {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>{t('common.currency')}</Label>
                  <Select
                    value={currency}
                    onValueChange={(value) => switchCurrency(value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((curr) => (
                        <SelectItem key={curr.code} value={curr.code}>
                          {curr.code} - {curr.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Pays</Label>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      {profile.country === 'FR' ? '🇫🇷 France' : '🇨🇭 Suisse'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Membre depuis</Label>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      {new Date(profile.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Actions Rapides</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Shield className="w-4 h-4 mr-2" />
                  Sécurité du compte
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Moyens de paiement
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-red-600 hover:text-red-700">
                  Supprimer le compte
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};