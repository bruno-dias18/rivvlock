import { useState, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';

type UserType = 'individual' | 'company' | 'independent';
type Country = 'FR' | 'CH';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const resetMode = searchParams.get('mode') === 'reset';
  const redirectTo = searchParams.get('redirect');
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(resetMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Registration form fields
  const [country, setCountry] = useState<Country>('FR');
  const [userType, setUserType] = useState<UserType>('individual');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [siretUid, setSiretUid] = useState('');
  const [avsNumber, setAvsNumber] = useState('');
  const [isSubjectToVat, setIsSubjectToVat] = useState(false);
  const [vatNumber, setVatNumber] = useState('');
  const [vatRate, setVatRate] = useState('');
  const [acceptanceTerms, setAcceptanceTerms] = useState(false);

  const { user, login, register } = useAuth();
  const { t } = useTranslation();

  // Set default VAT status based on user type
  useEffect(() => {
    if (userType === 'company') {
      setIsSubjectToVat(true);
      if (country === 'FR' && !vatRate) setVatRate('20');
      if (country === 'CH' && !vatRate) setVatRate('8.1');
    } else if (userType === 'independent') {
      setIsSubjectToVat(false);
    } else {
      setIsSubjectToVat(false);
      setVatNumber('');
      setVatRate('');
    }
  }, [userType, country]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    console.log('Form submission - Country:', country, 'UserType:', userType);
    console.log('Form values:', { firstName, lastName, phone, address, postalCode, city, companyName, siretUid, avsNumber, isSubjectToVat, vatNumber, vatRate });

    // Validation for sign up
    if (isSignUp) {
      if (!acceptanceTerms) {
        setError('Vous devez accepter les conditions générales');
        setLoading(false);
        return;
      }

      console.log('Validating fields for:', country, userType);

      // Country/UserType specific validations
      if (country === 'FR' && userType === 'company' && !siretUid) {
        setError('Le numéro SIRET est obligatoire pour les sociétés françaises');
        setLoading(false);
        return;
      }

      if (country === 'CH' && userType === 'independent' && !avsNumber) {
        console.log('AVS validation failed - avsNumber:', avsNumber);
        setError('Le numéro AVS est obligatoire pour les indépendants suisses');
        setLoading(false);
        return;
      }
    }

    try {
      if (isResetPassword) {
        // Handle password reset
        if (!password || !confirmPassword) {
          setError('Veuillez remplir tous les champs');
          setLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          setError('Les mots de passe ne correspondent pas');
          setLoading(false);
          return;
        }

        const { error: updateError } = await supabase.auth.updateUser({
          password: password
        });

        if (updateError) {
          setError('Erreur lors de la mise à jour du mot de passe');
          console.error('Password update error:', updateError);
          setLoading(false);
          return;
        }

        // Redirect to dashboard after successful password reset
        return;
      } else if (isSignUp) {
        // Prepare registration metadata
        const metadata = {
          user_type: userType,
          country,
          first_name: firstName,
          last_name: lastName,
          phone,
          address,
          postal_code: postalCode,
          city,
          company_name: companyName,
          company_address: companyAddress,
          siret_uid: siretUid,
          avs_number: avsNumber,
          is_subject_to_vat: isSubjectToVat,
          vat_number: vatNumber,
          tva_rate: country === 'FR' ? (vatRate ? parseFloat(vatRate) : null) : null,
          vat_rate: country === 'CH' ? (vatRate ? parseFloat(vatRate) : null) : null,
          acceptance_terms: acceptanceTerms,
          registration_complete: true
        };

        await register(email, password, metadata);
      } else {
        await login(email, password);
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

        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-destructive/15 border border-destructive/20 p-4">
              <div className="text-destructive text-sm">{error}</div>
            </div>
          )}

          {isSignUp && (
            <>
              {/* Country Selection */}
              <div>
                <label htmlFor="country" className="block text-sm font-medium text-foreground">
                  Pays *
                </label>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value as Country)}
                  className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                >
                  <option value="FR">France</option>
                  <option value="CH">Suisse</option>
                </select>
              </div>

              {/* User Type Selection */}
              <div>
                <label htmlFor="userType" className="block text-sm font-medium text-foreground">
                  Type de profil *
                </label>
                <select
                  id="userType"
                  value={userType}
                  onChange={(e) => setUserType(e.target.value as UserType)}
                  className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                >
                  <option value="individual">Particulier</option>
                  <option value="company">Société</option>
                  <option value="independent">Indépendant</option>
                </select>
              </div>

              {/* Personal Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-foreground">
                    Prénom *
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-foreground">
                    Nom *
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {/* Company Information */}
              {userType === 'company' && (
                <>
                  <div>
                    <label htmlFor="companyName" className="block text-sm font-medium text-foreground">
                      Nom de l'entreprise *
                    </label>
                    <input
                      id="companyName"
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      required={isFieldRequired('companyName')}
                    />
                  </div>
                  <div>
                    <label htmlFor="companyAddress" className="block text-sm font-medium text-foreground">
                      Adresse du siège social *
                    </label>
                    <textarea
                      id="companyAddress"
                      value={companyAddress}
                      onChange={(e) => setCompanyAddress(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      rows={2}
                      required={isFieldRequired('companyAddress')}
                    />
                  </div>
                  
                  {/* Company Postal Code and City */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="postalCode" className="block text-sm font-medium text-foreground">
                        Code postal *
                      </label>
                      <input
                        id="postalCode"
                        type="text"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Ex: 75001"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="city" className="block text-sm font-medium text-foreground">
                        Ville *
                      </label>
                      <input
                        id="city"
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Ex: Paris"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Contact Information */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-foreground">
                  Téléphone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>


              {/* Country and User Type Specific Fields */}
              {country === 'FR' && userType === 'company' && (
                <div>
                  <label htmlFor="siret" className="block text-sm font-medium text-foreground">
                    Numéro SIRET *
                  </label>
                  <input
                    id="siret"
                    type="text"
                    value={siretUid}
                    onChange={(e) => setSiretUid(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="14 chiffres"
                    required={isFieldRequired('siret')}
                  />
                </div>
              )}

              {country === 'CH' && userType === 'company' && (
                <div>
                  <label htmlFor="uid" className="block text-sm font-medium text-foreground">
                    Numéro UID *
                  </label>
                  <input
                    id="uid"
                    type="text"
                    value={siretUid}
                    onChange={(e) => setSiretUid(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="CHE-XXX.XXX.XXX"
                    required
                  />
                </div>
              )}

              {country === 'CH' && userType === 'independent' && (
                <div>
                  <label htmlFor="avs" className="block text-sm font-medium text-foreground">
                    Numéro AVS *
                  </label>
                  <input
                    id="avs"
                    type="text"
                    value={avsNumber}
                    onChange={(e) => setAvsNumber(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="756.XXXX.XXXX.XX"
                    required={isFieldRequired('avs')}
                  />
                </div>
              )}

              {/* VAT Management for Companies and Independents */}
              {(userType === 'company' || userType === 'independent') && (
                <div className="space-y-4">
                  <div className="flex items-start">
                    <input
                      id="subjectToVat"
                      type="checkbox"
                      checked={isSubjectToVat}
                      onChange={(e) => {
                        setIsSubjectToVat(e.target.checked);
                        if (!e.target.checked) {
                          setVatNumber('');
                          setVatRate('');
                        } else {
                          // Set default VAT rate based on country
                          if (country === 'FR' && !vatRate) setVatRate('20');
                          if (country === 'CH' && !vatRate) setVatRate('8.1');
                        }
                      }}
                      className="mt-1 h-4 w-4 text-primary focus:ring-primary border-border rounded"
                    />
                    <label htmlFor="subjectToVat" className="ml-2 block text-sm text-foreground">
                      Assujetti à la TVA
                    </label>
                  </div>

                  {isSubjectToVat && (
                    <>
                      <div>
                        <label htmlFor="vatNumber" className="block text-sm font-medium text-foreground">
                          Numéro de TVA {userType === 'company' ? '*' : ''}
                        </label>
                        <input
                          id="vatNumber"
                          type="text"
                          value={vatNumber}
                          onChange={(e) => setVatNumber(e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          placeholder={country === 'FR' ? 'FR XX XXX XXX XXX' : 'CHE-XXX.XXX.XXX TVA'}
                          required={userType === 'company'}
                        />
                      </div>

                      <div>
                        <label htmlFor="vatRate" className="block text-sm font-medium text-foreground">
                          Taux de TVA (%) *
                        </label>
                        <select
                          id="vatRate"
                          value={vatRate}
                          onChange={(e) => setVatRate(e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          required
                        >
                          <option value="">Sélectionnez un taux</option>
                          {country === 'FR' && (
                            <>
                              <option value="20">20% (Taux normal)</option>
                              <option value="10">10% (Taux intermédiaire)</option>
                              <option value="5.5">5,5% (Taux réduit)</option>
                              <option value="2.1">2,1% (Taux super réduit)</option>
                            </>
                          )}
                          {country === 'CH' && (
                            <>
                              <option value="8.1">8,1% (Taux normal)</option>
                              <option value="2.6">2,6% (Taux réduit)</option>
                              <option value="3.8">3,8% (Taux hébergement)</option>
                            </>
                          )}
                          <option value="custom">Autre (saisie manuelle)</option>
                        </select>
                        {vatRate === 'custom' && (
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            placeholder="Taux personnalisé"
                            className="mt-2 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            onChange={(e) => setVatRate(e.target.value)}
                          />
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Terms and Conditions */}
              <div className="flex items-start">
                <input
                  id="terms"
                  type="checkbox"
                  checked={acceptanceTerms}
                  onChange={(e) => setAcceptanceTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 text-primary focus:ring-primary border-border rounded"
                  required
                />
                <label htmlFor="terms" className="ml-2 block text-sm text-foreground">
                  J'accepte les <a href="#" className="text-primary hover:text-primary/90">conditions générales</a> et la <a href="#" className="text-primary hover:text-primary/90">politique de confidentialité</a> *
                </label>
              </div>
            </>
          )}

        {!isResetPassword && (
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Email *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Votre email"
            />
          </div>
        )}

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground">
            {isResetPassword ? 'Nouveau mot de passe *' : 'Mot de passe *'}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder={isResetPassword ? "Votre nouveau mot de passe" : "Votre mot de passe"}
          />
        </div>

        {isResetPassword && (
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
              Confirmer le mot de passe *
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Confirmer votre nouveau mot de passe"
            />
          </div>
        )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Chargement...' : (
                isResetPassword ? 'Définir le nouveau mot de passe' : 
                (isSignUp ? 'Créer le compte' : 'Se connecter')
              )}
            </button>
          </div>

          {!isResetPassword && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-primary hover:text-primary/90"
              >
                {isSignUp ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? S\'inscrire'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}