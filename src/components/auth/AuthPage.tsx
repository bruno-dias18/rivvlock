import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import logoImage from '@/assets/rivvlock-logo.png';

export type Country = 'FR' | 'CH';
export type UserType = 'individual' | 'company' | 'independent';

interface AuthFormData {
  country: Country;
  userType: UserType;
  email: string;
  password: string;
  // Individual fields
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  // Company fields
  companyName?: string;
  siret?: string;
  uid?: string;
  iban?: string;
  headquarters?: string;
  // Independent fields (CH only)
  avs?: string;
  vatNumber?: string;
  acceptTerms: boolean;
}

export const AuthPage = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [formData, setFormData] = useState<AuthFormData>({
    country: 'FR',
    userType: 'individual',
    email: '',
    password: '',
    acceptTerms: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Auth form submitted:', formData);
    // TODO: Implement auth with Supabase
  };

  const updateFormData = (updates: Partial<AuthFormData>) => {
    setFormData(prev => {
      const newData = { ...prev, ...updates };
      
      // Reset userType to individual if switching from CH to FR and was independent
      if (updates.country === 'FR' && prev.userType === 'independent') {
        newData.userType = 'individual';
      }
      
      return newData;
    });
  };

  const getTaxRate = (country: Country) => {
    return country === 'FR' ? '20%' : '8.1%';
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo & Title */}
        <div className="text-center space-y-4">
          <img 
            src={logoImage} 
            alt="RIVVLOCK Logo" 
            className="w-16 h-16 mx-auto"
          />
          <div>
            <h1 className="text-3xl font-bold text-primary tracking-tight">
              RIVVLOCK
            </h1>
            <p className="text-muted-foreground mt-2">
              {t('auth.subtitle')}
            </p>
          </div>
        </div>

        {/* Auth Form */}
        <Card className="animate-fade-in">
          <CardHeader>
            <Tabs value={mode} onValueChange={(value) => setMode(value as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">{t('common.login')}</TabsTrigger>
                <TabsTrigger value="register">{t('common.register')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <>
                  {/* Country Selection */}
                  <div className="space-y-2">
                    <Label>{t('auth.selectCountry')}</Label>
                    <Select
                      value={formData.country}
                      onValueChange={(value: Country) => updateFormData({ country: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FR">🇫🇷 {t('countries.france')}</SelectItem>
                        <SelectItem value="CH">🇨🇭 {t('countries.switzerland')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* User Type */}
                  <div className="space-y-3">
                    <Label>{t('auth.selectUserType')}</Label>
                    <RadioGroup
                      value={formData.userType}
                      onValueChange={(value: UserType) => updateFormData({ userType: value })}
                      className="grid grid-cols-1 gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="individual" id="individual" />
                        <Label htmlFor="individual" className="cursor-pointer">
                          {t('user.individual')}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="company" id="company" />
                        <Label htmlFor="company" className="cursor-pointer">
                          {t('user.company')}
                        </Label>
                      </div>
                      {/* Independent option only for Switzerland */}
                      {formData.country === 'CH' && (
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="independent" id="independent" />
                          <Label htmlFor="independent" className="cursor-pointer">
                            {t('user.independent')}
                          </Label>
                        </div>
                      )}
                    </RadioGroup>
                  </div>

                  {/* Dynamic Fields Based on User Type */}
                  {formData.userType === 'individual' || formData.userType === 'independent' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="firstName">{t('user.firstName')}</Label>
                        <Input
                          id="firstName"
                          value={formData.firstName || ''}
                          onChange={(e) => updateFormData({ firstName: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">{t('user.lastName')}</Label>
                        <Input
                          id="lastName"
                          value={formData.lastName || ''}
                          onChange={(e) => updateFormData({ lastName: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="companyName">{t('user.companyName')}</Label>
                        <Input
                          id="companyName"
                          value={formData.companyName || ''}
                          onChange={(e) => updateFormData({ companyName: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="businessId">
                            {formData.country === 'FR' ? t('user.siret') : t('user.uid')}
                          </Label>
                          <Input
                            id="businessId"
                            value={formData.country === 'FR' ? formData.siret || '' : formData.uid || ''}
                            onChange={(e) => {
                              const field = formData.country === 'FR' ? 'siret' : 'uid';
                              updateFormData({ [field]: e.target.value });
                            }}
                          />
                        </div>
                        <div>
                          <Label>{t('user.vat')} ({getTaxRate(formData.country)})</Label>
                          <Input disabled value={getTaxRate(formData.country)} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Independent-specific fields for Switzerland */}
                  {formData.userType === 'independent' && formData.country === 'CH' && (
                    <div className="space-y-3 border-t pt-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="avs">{t('user.avsOptional')}</Label>
                          <Input
                            id="avs"
                            value={formData.avs || ''}
                            onChange={(e) => updateFormData({ avs: e.target.value })}
                            placeholder="756.1234.5678.90"
                          />
                        </div>
                        <div>
                          <Label htmlFor="vatNumber">{t('user.vatOptional')} (8.1%)</Label>
                          <Input
                            id="vatNumber"
                            value={formData.vatNumber || ''}
                            onChange={(e) => updateFormData({ vatNumber: e.target.value })}
                            placeholder="CHE-123.456.789"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Common Fields */}
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="phone">{t('common.phone')}</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone || ''}
                        onChange={(e) => updateFormData({ phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="address">
                        {formData.userType === 'company' ? t('user.headquarters') : t('common.address')}
                      </Label>
                      <Input
                        id="address"
                        value={formData.userType === 'company' ? formData.headquarters || '' : formData.address || ''}
                        onChange={(e) => {
                          const field = formData.userType === 'company' ? 'headquarters' : 'address';
                          updateFormData({ [field]: e.target.value });
                        }}
                      />
                    </div>
                    {formData.userType === 'company' && (
                      <div>
                        <Label htmlFor="iban">{t('user.iban')}</Label>
                        <Input
                          id="iban"
                          value={formData.iban || ''}
                          onChange={(e) => updateFormData({ iban: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Email & Password */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="email">{t('common.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateFormData({ email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">{t('common.password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => updateFormData({ password: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Terms & Conditions */}
              {mode === 'register' && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="terms"
                    checked={formData.acceptTerms}
                    onCheckedChange={(checked) => updateFormData({ acceptTerms: checked as boolean })}
                  />
                  <Label htmlFor="terms" className="text-sm">
                    {t('auth.terms')} - {t('auth.termsText')}
                  </Label>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full gradient-primary text-white font-medium"
                disabled={mode === 'register' && !formData.acceptTerms}
              >
                {mode === 'login' ? t('common.login') : t('auth.createAccount')}
              </Button>

              {/* Toggle Mode */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                  className="text-sm text-primary hover:underline"
                >
                  {mode === 'login' ? t('auth.noAccount') : t('auth.alreadyHaveAccount')}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};