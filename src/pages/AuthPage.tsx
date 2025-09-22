import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

type Country = 'france' | 'switzerland';
type UserType = 'individual' | 'company' | 'independent';

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Profile fields
  const [country, setCountry] = useState<Country>('france');
  const [userType, setUserType] = useState<UserType>('individual');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [siretUid, setSiretUid] = useState('');
  const [avsNumber, setAvsNumber] = useState('');
  const [tvaRate, setTvaRate] = useState('');
  const [acceptanceTerms, setAcceptanceTerms] = useState(false);

  const { user, login, register } = useAuth();
  const { t } = useTranslation();

  // Redirect if already authenticated
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const validateForm = () => {
    if (!acceptanceTerms && isSignUp) {
      setError('Vous devez accepter les conditions générales');
      return false;
    }
    
    if (isSignUp) {
      if (!firstName || !lastName) {
        setError('Le prénom et nom sont obligatoires');
        return false;
      }
      
      if (userType === 'company') {
        if (!companyName) {
          setError('Le nom de société est obligatoire');
          return false;
        }
        if (country === 'france' && !siretUid) {
          setError('Le SIRET est obligatoire pour les sociétés françaises');
          return false;
        }
      }
      
      if (userType === 'independent' && country === 'switzerland' && !avsNumber) {
        setError('Le numéro AVS est obligatoire pour les indépendants suisses');
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // Prepare metadata for registration
        const metadata = {
          user_type: userType,
          country: country === 'france' ? 'FR' : 'CH',
          first_name: firstName,
          last_name: lastName,
          phone,
          address,
          company_name: companyName,
          company_address: companyAddress,
          siret_uid: siretUid,
          avs_number: avsNumber,
          tva_rate: tvaRate ? parseFloat(tvaRate) : null,
          vat_rate: tvaRate ? parseFloat(tvaRate) : null,
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
      <div className="text-center">
        <div className="mb-8">
          <img 
            src="/assets/rivvlock-logo.jpeg" 
            alt="RIVVLOCK Logo" 
            className="mx-auto h-24 w-auto object-contain"
          />
        </div>
        <h2 className="text-3xl font-bold text-foreground">
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {isSignUp ? 'Sign up for RivvLock' : 'Sign in to your account'}
        </p>
      </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-destructive/15 border border-destructive/20 p-4">
              <div className="text-destructive text-sm">{error}</div>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              {t('common.email')}
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
              placeholder={t('common.email')}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              {t('common.password')}
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
              placeholder={t('common.password')}
            />
          </div>

          {isSignUp && (
            <>
              {/* Country Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Pays
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setCountry('france')}
                    className={`p-3 border rounded-md text-sm font-medium transition-colors ${
                      country === 'france'
                        ? 'bg-primary text-primary-foreground border-primary' 
                        : 'bg-background text-foreground border-border hover:bg-accent'
                    }`}
                  >
                    🇫🇷 France
                  </button>
                  <button
                    type="button"
                    onClick={() => setCountry('switzerland')}
                    className={`p-3 border rounded-md text-sm font-medium transition-colors ${
                      country === 'switzerland'
                        ? 'bg-primary text-primary-foreground border-primary' 
                        : 'bg-background text-foreground border-border hover:bg-accent'
                    }`}
                  >
                    🇨🇭 Suisse
                  </button>
                </div>
              </div>

              {/* User Type Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Type de profil
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {(['individual', 'company', 'independent'] as UserType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setUserType(type)}
                      className={`p-3 border rounded-md text-sm font-medium transition-colors text-left ${
                        userType === type
                          ? 'bg-primary text-primary-foreground border-primary' 
                          : 'bg-background text-foreground border-border hover:bg-accent'
                      }`}
                    >
                      {type === 'individual' && '👤 Particulier'}
                      {type === 'company' && '🏢 Société'}
                      {type === 'independent' && '💼 Indépendant'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Personal Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-foreground">
                    {t('user.firstName')} *
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-foreground">
                    {t('user.lastName')} *
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

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

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-foreground">
                  Adresse
                </label>
                <textarea
                  id="address"
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              {/* Company Information */}
              {userType === 'company' && (
                <>
                  <div>
                    <label htmlFor="companyName" className="block text-sm font-medium text-foreground">
                      {t('user.companyName')} *
                    </label>
                    <input
                      id="companyName"
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="companyAddress" className="block text-sm font-medium text-foreground">
                      Adresse du siège social
                    </label>
                    <textarea
                      id="companyAddress"
                      rows={2}
                      value={companyAddress}
                      onChange={(e) => setCompanyAddress(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </>
              )}

              {/* Country-specific fields */}
              {country === 'france' && userType !== 'individual' && (
                <div>
                  <label htmlFor="siretUid" className="block text-sm font-medium text-foreground">
                    SIRET {userType === 'company' && '*'}
                  </label>
                  <input
                    id="siretUid"
                    type="text"
                    required={userType === 'company'}
                    value={siretUid}
                    onChange={(e) => setSiretUid(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="12345678901234"
                  />
                </div>
              )}

              {country === 'switzerland' && userType === 'independent' && (
                <div>
                  <label htmlFor="avsNumber" className="block text-sm font-medium text-foreground">
                    Numéro AVS *
                  </label>
                  <input
                    id="avsNumber"
                    type="text"
                    required
                    value={avsNumber}
                    onChange={(e) => setAvsNumber(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="756.1234.5678.90"
                  />
                </div>
              )}

              {country === 'switzerland' && userType === 'company' && (
                <div>
                  <label htmlFor="siretUid" className="block text-sm font-medium text-foreground">
                    Numéro UID *
                  </label>
                  <input
                    id="siretUid"
                    type="text"
                    required
                    value={siretUid}
                    onChange={(e) => setSiretUid(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="CHE-123.456.789"
                  />
                </div>
              )}

              {/* TVA/VAT */}
              {userType !== 'individual' && (
                <div>
                  <label htmlFor="tvaRate" className="block text-sm font-medium text-foreground">
                    Numéro TVA {userType === 'company' && country === 'france' ? '*' : ''}
                  </label>
                  <input
                    id="tvaRate"
                    type="text"
                    required={userType === 'company' && country === 'france'}
                    value={tvaRate}
                    onChange={(e) => setTvaRate(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder={country === 'france' ? 'FR12345678901' : 'CHE-123.456.789 TVA'}
                  />
                </div>
              )}

              {/* Terms and Conditions */}
              <div className="flex items-start space-x-2">
                <input
                  id="acceptanceTerms"
                  type="checkbox"
                  required
                  checked={acceptanceTerms}
                  onChange={(e) => setAcceptanceTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 text-primary focus:ring-primary border-border rounded"
                />
                <label htmlFor="acceptanceTerms" className="text-sm text-foreground">
                  J'accepte les <span className="text-primary hover:underline cursor-pointer">conditions générales d'utilisation</span> et la <span className="text-primary hover:underline cursor-pointer">politique de confidentialité</span> *
                </label>
              </div>
            </>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Veuillez patienter...' : (isSignUp ? 'Créer un compte' : 'Se connecter')}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-primary hover:text-primary/90"
            >
              {isSignUp ? 'Déjà un compte ? Se connecter' : "Pas de compte ? S'inscrire"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}