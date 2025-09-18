import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import logoImage from '@/assets/rivvlock-logo.png';

export type Country = 'FR' | 'CH';
export type UserType = 'individual' | 'company' | 'independent';

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData {
  country: Country;
  userType: UserType;
  email: string;
  password: string;
  confirmPassword: string;
  // Individual/Independent fields
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  // Company fields
  companyName?: string;
  siretUid?: string;
  companyAddress?: string;
  iban?: string;
  // Independent fields (CH only)
  avsNumber?: string;
  tvaRate?: number;
  acceptTerms: boolean;
}

export const AuthPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, login, register, loading } = useAuth();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  
  const [loginData, setLoginData] = useState<LoginData>({
    email: '',
    password: ''
  });

  const [registerData, setRegisterData] = useState<RegisterData>({
    country: 'FR',
    userType: 'individual',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  });

  // Redirect if already logged in
  useEffect(() => {
    if (user && !loading) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginData.email || !loginData.password) return;

    const { error } = await login(loginData.email, loginData.password);
    if (error) {
      let errorMessage = error.message;
      
      // Handle specific error cases
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Identifiants incorrects. Vérifiez votre email et mot de passe.';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Veuillez confirmer votre email avant de vous connecter.';
      }
      
      toast({
        variant: "destructive",
        title: t('auth.error'),
        description: errorMessage
      });
    } else {
      toast({
        title: t('auth.success'),
        description: 'Connexion réussie !'
      });
      navigate('/dashboard');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerData.email || !registerData.password || !registerData.confirmPassword) return;

    if (registerData.password !== registerData.confirmPassword) {
      toast({
        variant: "destructive",
        title: t('auth.error'),
        description: t('auth.passwordsDoNotMatch')
      });
      return;
    }

    const { error } = await register(registerData);
    if (error) {
      let errorMessage = error.message;
      
      // Handle specific errors
      if (error.message.includes('déjà utilisée')) {
        errorMessage = 'Cette adresse e-mail est déjà utilisée. Essayez de vous connecter.';
        toast({
          variant: "destructive",
          title: 'Compte existant',
          description: errorMessage
        });
        // Switch to login and prefill email
        setIsLogin(true);
        setLoginData(prev => ({ ...prev, email: registerData.email }));
        return;
      } else if (error.message.includes('sécurité')) {
        errorMessage = error.message;
      }
      
      toast({
        variant: "destructive",
        title: t('auth.error'),
        description: errorMessage
      });
    } else {
      toast({
        title: t('auth.success'),
        description: t('auth.checkEmailForConfirmation')
      });
      setIsLogin(true); // Switch to login form
    }
  };

  const updateRegisterData = (updates: Partial<RegisterData>) => {
    setRegisterData(prev => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

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
            <Tabs value={isLogin ? 'login' : 'register'} onValueChange={(value) => setIsLogin(value === 'login')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">{t('common.login')}</TabsTrigger>
                <TabsTrigger value="register">{t('common.register')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>

          <CardContent>
            {isLogin ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email">{t('common.email')}</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="login-password">{t('common.password')}</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full gradient-primary text-white font-medium"
                  disabled={loading}
                >
                  {loading ? t('common.loading') : t('common.login')}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                {/* Country Selection */}
                <div className="space-y-2">
                  <Label>{t('auth.selectCountry')}</Label>
                  <Select
                    value={registerData.country}
                    onValueChange={(value: Country) => updateRegisterData({ country: value })}
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
                    value={registerData.userType}
                    onValueChange={(value: UserType) => updateRegisterData({ userType: value })}
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
                    {registerData.country === 'CH' && (
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
                {registerData.userType === 'individual' || registerData.userType === 'independent' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="firstName">{t('user.firstName')}</Label>
                      <Input
                        id="firstName"
                        value={registerData.firstName || ''}
                        onChange={(e) => updateRegisterData({ firstName: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">{t('user.lastName')}</Label>
                      <Input
                        id="lastName"
                        value={registerData.lastName || ''}
                        onChange={(e) => updateRegisterData({ lastName: e.target.value })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="companyName">{t('user.companyName')}</Label>
                      <Input
                        id="companyName"
                        value={registerData.companyName || ''}
                        onChange={(e) => updateRegisterData({ companyName: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="businessId">
                          {registerData.country === 'FR' ? t('user.siret') : t('user.uid')}
                        </Label>
                        <Input
                          id="businessId"
                          value={registerData.siretUid || ''}
                          onChange={(e) => updateRegisterData({ siretUid: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>{t('user.vat')} ({getTaxRate(registerData.country)})</Label>
                        <Input disabled value={getTaxRate(registerData.country)} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Independent-specific fields for Switzerland */}
                {registerData.userType === 'independent' && registerData.country === 'CH' && (
                  <div className="space-y-3 border-t pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="avs">{t('user.avsOptional')}</Label>
                        <Input
                          id="avs"
                          value={registerData.avsNumber || ''}
                          onChange={(e) => updateRegisterData({ avsNumber: e.target.value })}
                          placeholder="756.1234.5678.90"
                        />
                      </div>
                      <div>
                        <Label htmlFor="tvaRate">{t('user.vatOptional')} (8.1%)</Label>
                        <Input
                          id="tvaRate"
                          type="number"
                          step="0.1"
                          value={registerData.tvaRate || ''}
                          onChange={(e) => updateRegisterData({ tvaRate: parseFloat(e.target.value) || undefined })}
                          placeholder="8.1"
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
                      value={registerData.phone || ''}
                      onChange={(e) => updateRegisterData({ phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">
                      {registerData.userType === 'company' ? t('user.headquarters') : t('common.address')}
                    </Label>
                    <Input
                      id="address"
                      value={registerData.userType === 'company' ? registerData.companyAddress || '' : registerData.address || ''}
                      onChange={(e) => {
                        const field = registerData.userType === 'company' ? 'companyAddress' : 'address';
                        updateRegisterData({ [field]: e.target.value });
                      }}
                    />
                  </div>
                  {registerData.userType === 'company' && (
                    <div>
                      <Label htmlFor="iban">{t('user.iban')}</Label>
                      <Input
                        id="iban"
                        value={registerData.iban || ''}
                        onChange={(e) => updateRegisterData({ iban: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                {/* Email & Password */}
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="register-email">{t('common.email')}</Label>
                    <Input
                      id="register-email"
                      type="email"
                      value={registerData.email}
                      onChange={(e) => updateRegisterData({ email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-password">{t('common.password')}</Label>
                    <Input
                      id="register-password"
                      type="password"
                      value={registerData.password}
                      onChange={(e) => updateRegisterData({ password: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirm-password">{t('auth.confirmPassword')}</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={registerData.confirmPassword}
                      onChange={(e) => updateRegisterData({ confirmPassword: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Terms & Conditions */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="terms"
                    checked={registerData.acceptTerms}
                    onCheckedChange={(checked) => updateRegisterData({ acceptTerms: checked as boolean })}
                  />
                  <Label htmlFor="terms" className="text-sm">
                    {t('auth.acceptTerms')} - {t('auth.termsText')}
                  </Label>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full gradient-primary text-white font-medium"
                  disabled={!registerData.acceptTerms || loading}
                >
                  {loading ? t('common.loading') : t('auth.createAccount')}
                </Button>
              </form>
            )}

            {/* Toggle Mode */}
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-primary hover:underline"
              >
                {isLogin ? t('auth.noAccount') : t('auth.alreadyHaveAccount')}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};