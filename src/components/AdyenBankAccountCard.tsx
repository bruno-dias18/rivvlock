import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAdyenPayoutAccount } from '@/hooks/useAdyenPayoutAccount';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CreditCard, CheckCircle, Clock, Plus, Edit, AlertCircle } from 'lucide-react';
import { formatIBAN, getIBANValidationMessage, getExpectedIBANLength } from '@/lib/ibanValidation';

export function AdyenBankAccountCard() {
  const { user } = useAuth();
  const { payoutAccounts, defaultAccount, addPayoutAccount } = useAdyenPayoutAccount(user?.id);
  
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankFormData, setBankFormData] = useState({
    iban: '',
    bic: '',
    account_holder_name: '',
    bank_name: '',
    country: 'CH',
  });
  const [ibanError, setIbanError] = useState<string | null>(null);
  const [ibanTouched, setIbanTouched] = useState(false);

  const handleIBANChange = (value: string) => {
    setBankFormData({ ...bankFormData, iban: value.toUpperCase() });
    
    // Only show errors after user has started typing
    if (value.length > 0) {
      setIbanTouched(true);
      const error = getIBANValidationMessage(value);
      setIbanError(error);
    } else {
      setIbanError(null);
    }
  };

  const handleIBANBlur = () => {
    setIbanTouched(true);
    if (bankFormData.iban) {
      const error = getIBANValidationMessage(bankFormData.iban);
      setIbanError(error);
      
      // Auto-format on blur if valid
      if (!error) {
        setBankFormData({ ...bankFormData, iban: formatIBAN(bankFormData.iban) });
      }
    }
  };

  const isFormValid = () => {
    return (
      bankFormData.iban &&
      bankFormData.account_holder_name.length >= 2 &&
      !getIBANValidationMessage(bankFormData.iban)
    );
  };

  const handleBankAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      await addPayoutAccount.mutateAsync({
        user_id: user.id,
        ...bankFormData,
        is_default: true,
      });
      setShowBankForm(false);
      setBankFormData({
        iban: '',
        bic: '',
        account_holder_name: '',
        bank_name: '',
        country: 'CH',
      });
      setIbanError(null);
      setIbanTouched(false);
    } catch (error) {
      // Error handled by hook
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Compte bancaire (Adyen)
        </CardTitle>
        <CardDescription>
          Configurez votre IBAN pour recevoir les paiements via Adyen
        </CardDescription>
      </CardHeader>
      <CardContent>
        {defaultAccount ? (
          <div className="space-y-4">
            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  <span className="font-medium">Compte par défaut</span>
                </div>
                {defaultAccount.verified ? (
                  <Badge className="bg-success">
                    <CheckCircle className="h-3 w-3 mr-1" /> Vérifié
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <Clock className="h-3 w-3 mr-1" /> En attente
                  </Badge>
                )}
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <span className="text-muted-foreground">IBAN:</span>
                  <span className="font-mono break-all">{defaultAccount.iban}</span>
                </div>
                {defaultAccount.bic && (
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <span className="text-muted-foreground">BIC:</span>
                    <span className="font-mono">{defaultAccount.bic}</span>
                  </div>
                )}
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <span className="text-muted-foreground">Titulaire:</span>
                  <span>{defaultAccount.account_holder_name}</span>
                </div>
                {defaultAccount.bank_name && (
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <span className="text-muted-foreground">Banque:</span>
                    <span>{defaultAccount.bank_name}</span>
                  </div>
                )}
              </div>

              {!defaultAccount.verified && (
                <Alert className="mt-4">
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    Votre IBAN sera vérifié par notre équipe sous 24-48h.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Button
              variant="outline"
              onClick={() => setShowBankForm(!showBankForm)}
              className="w-full"
            >
              <Edit className="h-4 w-4 mr-2" />
              {showBankForm ? 'Annuler' : 'Modifier le compte'}
            </Button>
          </div>
        ) : (
          <Button onClick={() => setShowBankForm(true)} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un compte bancaire
          </Button>
        )}

        {showBankForm && (
          <form onSubmit={handleBankAccountSubmit} className="space-y-4 mt-6">
            <div>
              <Label htmlFor="iban">IBAN *</Label>
              <Input
                id="iban"
                value={bankFormData.iban}
                onChange={(e) => handleIBANChange(e.target.value)}
                onBlur={handleIBANBlur}
                placeholder="CH93 0076 2011 6238 5295 7"
                required
                className={ibanTouched && ibanError ? 'border-destructive' : ''}
              />
              {ibanTouched && ibanError && (
                <div className="flex items-center gap-2 mt-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{ibanError}</span>
                </div>
              )}
              {ibanTouched && !ibanError && bankFormData.iban && (
                <div className="flex items-center gap-2 mt-2 text-sm text-success">
                  <CheckCircle className="h-4 w-4" />
                  <span>✓ IBAN valide</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Exemple: CH93 0076 2011 6238 5295 7 (21 caractères pour la Suisse)
              </p>
            </div>

            <div>
              <Label htmlFor="bic">BIC / SWIFT (optionnel)</Label>
              <Input
                id="bic"
                value={bankFormData.bic}
                onChange={(e) => setBankFormData({ ...bankFormData, bic: e.target.value.toUpperCase() })}
                placeholder="UBSWCHZH80A"
              />
            </div>

            <div>
              <Label htmlFor="account_holder_name">Nom du titulaire *</Label>
              <Input
                id="account_holder_name"
                value={bankFormData.account_holder_name}
                onChange={(e) => setBankFormData({ ...bankFormData, account_holder_name: e.target.value })}
                placeholder="Jean Dupont"
                required
              />
            </div>

            <div>
              <Label htmlFor="bank_name">Nom de la banque (optionnel)</Label>
              <Input
                id="bank_name"
                value={bankFormData.bank_name}
                onChange={(e) => setBankFormData({ ...bankFormData, bank_name: e.target.value })}
                placeholder="UBS Switzerland AG"
              />
            </div>

            <div className="flex gap-2">
              <Button 
                type="submit" 
                disabled={addPayoutAccount.isPending || !isFormValid()} 
                className="flex-1"
              >
                {addPayoutAccount.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowBankForm(false);
                  setIbanError(null);
                  setIbanTouched(false);
                }}
              >
                Annuler
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
