import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/hooks/useLanguage';
import { useCurrency } from '@/hooks/useCurrency';
import { 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  Building, 
  CreditCard,
  Settings,
  Shield
} from 'lucide-react';

// Mock user data
const mockUser = {
  id: '1',
  type: 'company' as const,
  country: 'FR' as const,
  email: 'contact@techsolutions.fr',
  phone: '+33 1 23 45 67 89',
  // Company fields
  companyName: 'Tech Solutions SARL',
  siret: '12345678901234',
  iban: 'FR14 2004 1010 0505 0001 3M02 606',
  headquarters: '123 Rue de la Technologie, 75001 Paris',
  // Individual fields would be: firstName, lastName, address
  createdAt: '2024-01-15',
  verified: true,
};

export const Profile = () => {
  const { t } = useTranslation();
  const { languages, switchLanguage, currentLanguageInfo } = useLanguage();
  const { currencies, switchCurrency, currency } = useCurrency();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(mockUser);

  const handleSave = () => {
    console.log('Saving profile data:', formData);
    setIsEditing(false);
    // TODO: Implement profile update with Supabase
  };

  const getVATRate = (country: 'FR' | 'CH') => {
    return country === 'FR' ? '20%' : '8.1%';
  };

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
            {mockUser.verified && (
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Profile Information */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {mockUser.type === 'company' ? (
                    <Building className="w-5 h-5" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                  Informations {mockUser.type === 'company' ? 'Entreprise' : 'Personnelles'}
                </CardTitle>
                <CardDescription>
                  Données fiscales et informations légales
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {mockUser.type === 'company' ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="companyName">{t('user.companyName')}</Label>
                        <Input
                          id="companyName"
                          value={formData.companyName}
                          onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                          disabled={!isEditing}
                        />
                      </div>
                      <div>
                        <Label htmlFor="siret">
                          {mockUser.country === 'FR' ? t('user.siret') : t('user.uid')}
                        </Label>
                        <Input
                          id="siret"
                          value={formData.siret}
                          onChange={(e) => setFormData(prev => ({ ...prev, siret: e.target.value }))}
                          disabled={!isEditing}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="headquarters">{t('user.headquarters')}</Label>
                      <Input
                        id="headquarters"
                        value={formData.headquarters}
                        onChange={(e) => setFormData(prev => ({ ...prev, headquarters: e.target.value }))}
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="iban">{t('user.iban')}</Label>
                        <Input
                          id="iban"
                          value={formData.iban}
                          onChange={(e) => setFormData(prev => ({ ...prev, iban: e.target.value }))}
                          disabled={!isEditing}
                        />
                      </div>
                      <div>
                        <Label>{t('user.vat')} ({getVATRate(mockUser.country)})</Label>
                        <Input disabled value={getVATRate(mockUser.country)} />
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
                          disabled={!isEditing}
                          placeholder="Jean"
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">{t('user.lastName')}</Label>
                        <Input
                          id="lastName"
                          disabled={!isEditing}
                          placeholder="Dupont"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="address">{t('common.address')}</Label>
                      <Input
                        id="address"
                        disabled={!isEditing}
                        placeholder="123 Rue de la Paix, 75001 Paris"
                      />
                    </div>
                  </>
                )}

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">{t('common.email')}</Label>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="phone">{t('common.phone')}</Label>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
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
                      {mockUser.country === 'FR' ? '🇫🇷 France' : '🇨🇭 Suisse'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Membre depuis</Label>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      {new Date(mockUser.createdAt).toLocaleDateString()}
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