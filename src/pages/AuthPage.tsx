import { useState, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createRegistrationSchema, loginSchema, changePasswordSchema } from '@/lib/validations';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { MaskedVatInput } from '@/components/ui/masked-vat-input';
import { MaskedUidInput } from '@/components/ui/masked-uid-input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from '@/components/LanguageSelector';

type UserType = 'individual' | 'company' | 'independent';
type Country = 'FR' | 'CH';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const resetMode = searchParams.get('mode') === 'reset';
  const redirectTo = searchParams.get('redirect');
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(resetMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Watch form values for dynamic validation
  const [country, setCountry] = useState<'FR' | 'CH'>('FR');
  const [userType, setUserType] = useState<'individual' | 'company' | 'independent'>('individual');

  const { user, login, register } = useAuth();
  const { t } = useTranslation();

  // Dynamic form schema based on current selections
  const getFormSchema = () => {
    if (isResetPassword) {
      return changePasswordSchema;
    } else if (isSignUp) {
      return createRegistrationSchema(country, userType);
    } else {
      return loginSchema;
    }
  };

  const form = useForm({
    resolver: zodResolver(getFormSchema()),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      country: 'FR' as const,
      userType: 'individual' as const,
      firstName: '',
      lastName: '',
      phone: '',
      companyName: '',
      companyAddress: '',
      postalCode: '',
      city: '',
      siretUid: '',
      avsNumber: '',
      isSubjectToVat: false,
      vatNumber: '',
      vatRate: '',
      acceptanceTerms: false
    }
  });

  // Watch for country and userType changes to update schema
  const watchedCountry = form.watch('country');
  const watchedUserType = form.watch('userType');
  const watchedIsSubjectToVat = form.watch('isSubjectToVat');

  // Update local state when form values change
  useEffect(() => {
    if (watchedCountry && watchedCountry !== country) {
      setCountry(watchedCountry);
    }
  }, [watchedCountry, country]);

  useEffect(() => {
    if (watchedUserType && watchedUserType !== userType) {
      setUserType(watchedUserType);
    }
  }, [watchedUserType, userType]);

  // Set default VAT status and rates based on user type and country
  useEffect(() => {
    if (isSignUp) {
      if (userType === 'company') {
        form.setValue('isSubjectToVat', true);
        if (country === 'FR' && !form.getValues('vatRate')) {
          form.setValue('vatRate', '20');
        }
        if (country === 'CH' && !form.getValues('vatRate')) {
          form.setValue('vatRate', '8.1');
        }
      } else if (userType === 'independent') {
        form.setValue('isSubjectToVat', false);
      } else {
        form.setValue('isSubjectToVat', false);
        form.setValue('vatNumber', '');
        form.setValue('vatRate', '');
      }
    }
  }, [userType, country, isSignUp, form]);

  // Check for auth state changes and session recovery
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setIsResetPassword(true);
        setError('');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Redirect if already authenticated
  if (user) {
    const destination = redirectTo || '/dashboard';
    return <Navigate to={destination} replace />;
  }

  const onSubmit = async (data: any) => {
    setLoading(true);
    setError('');

    try {
      if (isResetPassword) {
        const { error: updateError } = await supabase.auth.updateUser({
          password: data.password
        });

        if (updateError) {
          setError('Erreur lors de la mise à jour du mot de passe');
          console.error('Password update error:', updateError);
          return;
        }

        // Redirect to dashboard after successful password reset
        return;
      } else if (isSignUp) {
        // Prepare registration metadata
        const metadata = {
          user_type: data.userType,
          country: data.country,
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone || '',
          address: '',
          postal_code: data.postalCode || '',
          city: data.city || '',
          company_name: data.companyName || '',
          company_address: data.companyAddress || '',
          siret_uid: data.siretUid || '',
          avs_number: data.avsNumber || '',
          is_subject_to_vat: data.isSubjectToVat || false,
          vat_number: data.vatNumber || '',
          tva_rate: data.country === 'FR' ? (data.vatRate ? parseFloat(data.vatRate) : null) : null,
          vat_rate: data.country === 'CH' ? (data.vatRate ? parseFloat(data.vatRate) : null) : null,
          acceptance_terms: data.acceptanceTerms,
          registration_complete: true
        };

        await register(data.email, data.password, metadata);
      } else {
        await login(data.email, data.password);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const isFieldRequired = (field: string): boolean => {
    if (!isSignUp) return false;
    
    switch (field) {
      case 'siret':
        return country === 'FR' && userType === 'company';
      case 'avs':
        return country === 'CH' && userType === 'independent';
      case 'companyName':
        return userType === 'company';
      case 'companyAddress':
        return userType === 'company';
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mb-8">
            <img 
              src="/assets/rivvlock-logo.jpeg" 
              alt="RIVVLOCK Logo" 
              className="mx-auto h-24 w-auto object-contain"
            />
          </div>
          <h2 className="text-3xl font-bold text-foreground">
            {isResetPassword ? 'Nouveau mot de passe' : (isSignUp ? 'Créer un compte' : 'Bienvenue')}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {isResetPassword ? 'Définissez votre nouveau mot de passe' : (isSignUp ? 'Inscription sur RivvLock' : 'Connectez-vous à votre compte')}
          </p>
        </div>

        <Form {...form}>
          <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            {error && (
              <div className="rounded-md bg-destructive/15 border border-destructive/20 p-4">
                <div className="text-destructive text-sm">{error}</div>
              </div>
            )}

            {isSignUp && (
              <>
                {/* Country Selection */}
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pays *</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                          <option value="FR">France</option>
                          <option value="CH">Suisse</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* User Type Selection */}
                <FormField
                  control={form.control}
                  name="userType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type de profil *</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                          <option value="individual">Particulier</option>
                          <option value="company">Société</option>
                          <option value="independent">Indépendant</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Personal Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prénom *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Votre prénom" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Votre nom" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Company Information */}
                {userType === 'company' && (
                  <>
                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom de l'entreprise *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Nom de votre entreprise" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="companyAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Adresse du siège social *</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={2} placeholder="Adresse complète du siège social" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* Company Postal Code and City */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="postalCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Code postal *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Ex: 75001" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ville *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Ex: Paris" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}

                {/* Contact Information */}
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Téléphone</FormLabel>
                      <FormControl>
                        <Input {...field} type="tel" placeholder="+33 1 23 45 67 89" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Country and User Type Specific Fields */}
                {country === 'FR' && userType === 'company' && (
                  <FormField
                    control={form.control}
                    name="siretUid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Numéro SIRET *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="12345678901234" />
                        </FormControl>
                        <FormDescription>
                          Format : 14 chiffres (espaces et tirets autorisés)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {country === 'CH' && userType === 'company' && (
                  <FormField
                    control={form.control}
                    name="siretUid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Numéro UID *</FormLabel>
                        <FormControl>
                          <MaskedUidInput {...field} />
                        </FormControl>
                        <FormDescription>
                          Format : CHE-XXX.XXX.XXX
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {country === 'CH' && userType === 'independent' && (
                  <FormField
                    control={form.control}
                    name="avsNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Numéro AVS *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="756.1234.5678.90" />
                        </FormControl>
                        <FormDescription>
                          Format : 756.XXXX.XXXX.XX
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* VAT Management for Companies and Independents */}
                {(userType === 'company' || userType === 'independent') && (
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="isSubjectToVat"
                      render={({ field }) => (
                        <FormItem className="flex items-start space-x-3">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="mt-1 h-4 w-4 text-primary focus:ring-primary border-border rounded"
                            />
                          </FormControl>
                          <div className="grid gap-1.5 leading-none">
                            <FormLabel className="text-sm font-normal">
                              {userType === 'company' ? 'Assujetti à la TVA' : 'Indépendant assujetti à la TVA'}
                            </FormLabel>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {watchedIsSubjectToVat && (
                      <>
                        <FormField
                          control={form.control}
                          name="vatNumber"
                          render={({ field }) => (
                            <FormItem>
                               <FormLabel>
                                 Numéro de TVA *
                               </FormLabel>
                              <FormControl>
                                <MaskedVatInput 
                                  country={country}
                                  value={field.value}
                                  onChange={field.onChange}
                                  placeholder={country === 'FR' ? 'FR12345678901' : 'CHE-123.456.789 TVA'}
                                />
                              </FormControl>
                               <FormDescription>
                                 {country === 'CH' 
                                   ? "Numéro de TVA suisse" 
                                   : "Numéro de TVA français"
                                 }
                               </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="vatRate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Taux de TVA (%)</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder={country === 'FR' ? '20' : '8.1'} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                  </div>
                )}

                {/* Terms and Conditions */}
                <FormField
                  control={form.control}
                  name="acceptanceTerms"
                  render={({ field }) => (
                    <FormItem className="flex items-start space-x-3">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="mt-1 h-4 w-4 text-primary focus:ring-primary border-border rounded"
                        />
                      </FormControl>
                      <div className="grid gap-1.5 leading-none">
                        <FormLabel className="text-sm font-normal">
                          J'accepte les{' '}
                          <a href="/terms" className="text-primary hover:underline">
                            conditions générales d'utilisation
                          </a>
                        </FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Email and Password Fields */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="votre@email.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {isResetPassword ? 'Nouveau mot de passe *' : 'Mot de passe *'}
                  </FormLabel>
                  <FormControl>
                    <Input {...field} type="password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(isSignUp || isResetPassword) && (
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmer le mot de passe *</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Chargement...' : (
                  isResetPassword ? 'Changer le mot de passe' :
                  isSignUp ? 'Créer mon compte' :
                  'Se connecter'
                )}
              </Button>
            </div>

            {!isResetPassword && (
              <>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-primary hover:underline text-sm"
                  >
                    {isSignUp ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? S\'inscrire'}
                  </button>
                </div>

                {!isSignUp && (
                  <div className="text-center">
                    <a
                      href="/auth?mode=reset"
                      className="text-muted-foreground hover:text-primary text-sm"
                    >
                      Mot de passe oublié ?
                    </a>
                  </div>
                )}
              </>
            )}
          </form>
        </Form>
      </div>
    </div>
  );
}