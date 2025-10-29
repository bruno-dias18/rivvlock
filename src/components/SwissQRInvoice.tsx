import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface SwissQRInvoiceProps {
  // Transaction data
  amount: number;
  currency: string;
  reference: string; // 27-digit QRR reference
  title: string;
  
  // Buyer info (optional)
  buyerName?: string;
  buyerAddress?: string;
  buyerCity?: string;
  buyerPostalCode?: string;
}

// GENINT SA / Valiant Bank fixed data
const CREDITOR = {
  name: 'GENINT SA',
  street: 'Rue jean-calvin 12',
  postalCode: '1204',
  city: 'Geneve',
  country: 'CH'
};

const QR_IBAN = 'CH98 3002 4507 1962 5267 9';
const BIC = 'VABECH22XXX';

/**
 * Format QRR reference for display (groups of 5 digits)
 * Example: 210000000003993200140900116 -> 21 00000 00003 99320 01409 00116
 */
function formatQRReference(reference: string): string {
  if (!reference || reference.length !== 27) {
    return reference;
  }
  
  return `${reference.substring(0, 2)} ${reference.substring(2, 7)} ${reference.substring(7, 12)} ${reference.substring(12, 17)} ${reference.substring(17, 22)} ${reference.substring(22, 27)}`;
}

/**
 * Generate Swiss QR-Invoice payload according to Swiss Payment Standards 2020
 */
function generateQRInvoicePayload(props: SwissQRInvoiceProps): string {
  const lines: string[] = [];

  // 1. Swiss QR Code Header
  lines.push('SPC'); // Swiss Payment Code
  lines.push('0200'); // Version 02.00
  lines.push('1'); // Coding Type UTF-8

  // 2. Account (QR-IBAN)
  lines.push(QR_IBAN.replace(/\s/g, ''));

  // 3. Creditor (GENINT SA)
  lines.push('S'); // Structured address
  lines.push(CREDITOR.name);
  lines.push(CREDITOR.street);
  lines.push(CREDITOR.postalCode);
  lines.push(CREDITOR.city);
  lines.push(CREDITOR.country);
  lines.push(''); // Building number

  // 4. Ultimate Creditor (empty)
  lines.push(...Array(7).fill(''));

  // 5. Amount
  lines.push(props.amount.toFixed(2));
  lines.push(props.currency.toUpperCase());

  // 6. Ultimate Debtor (Buyer)
  if (props.buyerName) {
    lines.push('K'); // Combined address
    lines.push(props.buyerName);
    lines.push(props.buyerAddress || '');
    lines.push(props.buyerPostalCode || '');
    lines.push(props.buyerCity || '');
    lines.push('CH');
    lines.push('');
  } else {
    lines.push(...Array(7).fill(''));
  }

  // 7. Reference
  lines.push('QRR'); // QR Reference type
  lines.push(props.reference);

  // 8. Additional Information
  lines.push(props.title || ''); // Unstructured message
  lines.push('EPD'); // End Payment Data

  // 9. Billing Information (empty)
  lines.push('');

  // 10. Alternative Schemes (empty)
  lines.push('');
  lines.push('');

  return lines.join('\r\n');
}

export function SwissQRInvoice(props: SwissQRInvoiceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !props.reference) return;

    const payload = generateQRInvoicePayload(props);
    
    QRCode.toCanvas(canvasRef.current, payload, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    }).catch(err => {
      console.error('QR Code generation error:', err);
      toast.error('Erreur lors de la génération du QR code');
    });
  }, [props.reference, props.amount, props.currency, props.title, props.buyerName]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copié !`);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;

    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QR-invoice-${props.reference}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('QR-Invoice téléchargé');
    });
  };

  if (!props.reference) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">
            Pas de référence de paiement disponible
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Virement bancaire CHF (QR-Invoice)</span>
          <Button variant="ghost" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Télécharger
          </Button>
        </CardTitle>
        <CardDescription>
          Scannez le QR-code ou utilisez les informations ci-dessous
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* QR Code */}
        <div className="flex justify-center p-6 bg-white rounded-lg border-2 border-border">
          <canvas ref={canvasRef} className="max-w-full" />
        </div>

        {/* Payment Instructions */}
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm mb-3">📱 Paiement par mobile banking</h4>
            <p className="text-sm text-muted-foreground">
              Ouvrez votre app bancaire → Scanner QR-facture → Confirmer le paiement
            </p>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold text-sm mb-3">💻 Virement manuel (e-banking)</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">IBAN QR</p>
                  <p className="font-mono text-sm">{QR_IBAN}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(QR_IBAN.replace(/\s/g, ''), 'IBAN')}
                >
                  {copied === 'IBAN' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Bénéficiaire</p>
                <p className="text-sm">{CREDITOR.name}</p>
                <p className="text-sm text-muted-foreground">
                  {CREDITOR.street}, {CREDITOR.postalCode} {CREDITOR.city}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Montant</p>
                <p className="text-sm font-semibold">
                  {props.currency.toUpperCase()} {props.amount.toLocaleString('fr-CH', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Référence <span className="text-destructive">*</span>
                  </p>
                  <p className="font-mono text-xs break-all">
                    {formatQRReference(props.reference)}
                  </p>
                  <p className="text-xs text-destructive mt-1">
                    ⚠️ OBLIGATOIRE pour l'identification du paiement
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(props.reference, 'Référence')}
                >
                  {copied === 'Référence' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {props.title && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Communication</p>
                  <p className="text-sm">{props.title}</p>
                </div>
              )}

              <div className="bg-muted/50 p-3 rounded-lg mt-4">
                <p className="text-xs text-muted-foreground">
                  💡 <strong>Important:</strong> La référence à 27 chiffres est essentielle pour identifier votre paiement automatiquement. Sans elle, votre paiement ne pourra pas être traité.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
