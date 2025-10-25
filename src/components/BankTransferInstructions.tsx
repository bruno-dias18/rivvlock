import { Transaction } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Copy, CheckCircle, Zap, Clock } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/useToast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface BankTransferInstructionsProps {
  transaction: Transaction;
  paymentIntentId?: string;
}

export const BankTransferInstructions = ({ 
  transaction, 
  paymentIntentId = '' 
}: BankTransferInstructionsProps) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { toast } = useToast();

  // In production, these would come from Stripe or Supabase
  const bankDetails = {
    iban: "FR76 1234 5678 9012 3456 7890 123",
    bic: "RIVVFRPP",
    accountHolder: "RIVVLOCK SAS",
    reference: `RIVV-${transaction.id.slice(0, 8).toUpperCase()}`,
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`${field} copié dans le presse-papiers`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-4">
      <Alert className="border-primary/50 bg-primary/5">
        <Zap className="h-4 w-4 text-primary" />
        <AlertTitle className="text-primary">Conseil pour un paiement rapide</AlertTitle>
        <AlertDescription>
          <div className="mt-2 space-y-2">
            <p className="font-medium">
              Demandez à votre banque d'effectuer un <strong>virement SEPA Instant</strong>
            </p>
            <ul className="text-sm space-y-1 ml-4 list-disc">
              <li>Paiement reçu en <strong>moins de 30 minutes</strong></li>
              <li>Disponible 24h/24, 7j/7</li>
              <li>Généralement gratuit ou coût minime (vérifiez avec votre banque)</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              ⚠️ Un virement SEPA standard peut prendre <strong>1-3 jours ouvrables</strong>
            </p>
            <p className="text-xs mt-2 text-muted-foreground">
              💡 <strong>Alternative :</strong> Si vous payez par carte bancaire, SEPA Direct Debit sera disponible (prélèvement automatique, si délai ≥ 3 jours)
            </p>
          </div>
        </AlertDescription>
      </Alert>

      {transaction.payment_deadline && (
        <Alert variant="destructive">
          <Clock className="h-4 w-4" />
          <AlertTitle>Date limite de paiement</AlertTitle>
          <AlertDescription>
            <p className="font-medium">
              {format(new Date(transaction.payment_deadline), 'PPp', { locale: fr })}
            </p>
            <p className="text-xs mt-1">
              Le paiement doit être reçu avant cette date pour que la transaction soit validée
            </p>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Instructions de virement bancaire
          </CardTitle>
          <CardDescription>
            Effectuez un virement avec les informations ci-dessous
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-start p-3 bg-muted rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">IBAN</p>
                <p className="font-mono text-sm mt-1">{bankDetails.iban}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(bankDetails.iban.replace(/\s/g, ''), "IBAN")}
              >
                {copiedField === "IBAN" ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex justify-between items-start p-3 bg-muted rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">BIC/SWIFT</p>
                <p className="font-mono text-sm mt-1">{bankDetails.bic}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(bankDetails.bic, "BIC")}
              >
                {copiedField === "BIC" ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex justify-between items-start p-3 bg-muted rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Bénéficiaire</p>
                <p className="font-mono text-sm mt-1">{bankDetails.accountHolder}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(bankDetails.accountHolder, "Bénéficiaire")}
              >
                {copiedField === "Bénéficiaire" ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex justify-between items-start p-3 bg-muted rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Montant</p>
                <p className="text-lg font-bold mt-1">
                  {transaction.price} {transaction.currency.toUpperCase()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(transaction.price.toString(), "Montant")}
              >
                {copiedField === "Montant" ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex justify-between items-start p-3 bg-primary/10 rounded-lg border-2 border-primary">
              <div className="flex-1">
                <p className="text-sm font-medium text-primary">
                  Référence de paiement (obligatoire)
                </p>
                <p className="font-mono text-lg font-bold mt-1">{bankDetails.reference}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cette référence est essentielle pour identifier votre paiement
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(bankDetails.reference, "Référence")}
              >
                {copiedField === "Référence" ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <Alert>
            <AlertDescription className="text-sm">
              <strong>Important :</strong> Une fois le virement effectué, vous recevrez une 
              confirmation par email dès réception des fonds. La transaction passera alors au 
              statut "Payé" et les fonds seront bloqués jusqu'à validation.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};
