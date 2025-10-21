import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Info } from 'lucide-react';
import { Currency } from '@/types';

interface ProposalFeeDistributionProps {
  feeRatio: number;
  totalAmount: number;
  clientFees: number;
  sellerFees: number;
  finalPrice: number;
  currency: Currency;
  autoDistributionApplied: boolean;
  onFeeRatioChange: (value: number) => void;
  onApplyAutoDistribution: () => void;
}

/**
 * Sous-composant pour la répartition des frais de plateforme
 * Mémoïsé pour éviter les re-renders inutiles
 */
export const ProposalFeeDistribution = React.memo(
  ({
    feeRatio,
    totalAmount,
    clientFees,
    sellerFees,
    finalPrice,
    currency,
    autoDistributionApplied,
    onFeeRatioChange,
    onApplyAutoDistribution,
  }: ProposalFeeDistributionProps) => {
    const [showFeeDetails, setShowFeeDetails] = React.useState(false);

    if (totalAmount === 0) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            Répartition des frais de plateforme (5%)
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowFeeDetails(!showFeeDetails)}
          >
            <Info className="h-4 w-4" />
          </Button>
        </div>

        {showFeeDetails && (
          <Alert className="text-xs">
            <AlertDescription>
              Les frais de plateforme RivvLock (5%) couvrent la sécurisation des
              paiements, le support client et la médiation. Déplacez le curseur
              pour répartir les frais entre vous et votre client : 0% = vous
              payez tout, 100% = client paie tout.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Client paie</span>
            <Badge variant="secondary" className="font-mono">
              {feeRatio}%
            </Badge>
          </div>

          <Slider
            value={[feeRatio]}
            onValueChange={([value]) => onFeeRatioChange(value)}
            min={0}
            max={100}
            step={10}
            className="w-full"
          />

          <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-muted/50">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Frais à charge du client
              </p>
              <p className="font-semibold text-base">
                {clientFees.toFixed(2)} {currency.toUpperCase()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Frais à votre charge
              </p>
              <p className="font-semibold text-base">
                {sellerFees.toFixed(2)} {currency.toUpperCase()}
              </p>
            </div>
          </div>

          <Separator />

          {/* Boutons répartition */}
          <div className="space-y-3 p-4 rounded-lg bg-muted/30 border">
            <p className="text-sm text-muted-foreground">
              {autoDistributionApplied
                ? '✓ Les frais ont été répartis automatiquement sur toutes les lignes'
                : 'Choisissez comment gérer les frais :'}
            </p>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={autoDistributionApplied ? 'outline' : 'default'}
                size="sm"
                onClick={onApplyAutoDistribution}
                disabled={feeRatio === 0}
                className="flex-1"
              >
                {autoDistributionApplied ? 'Réappliquer' : 'Répartir automatiquement'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => {
                  if (autoDistributionApplied) {
                    // Just a visual feedback, user can manually adjust items
                  }
                }}
              >
                Ajuster manuellement
              </Button>
            </div>

            {!autoDistributionApplied && feeRatio > 0 && (
              <p className="text-xs text-muted-foreground italic">
                💡 Avec "Répartir automatiquement", les prix seront ajustés
                proportionnellement. Avec "Ajuster manuellement", modifiez
                vous-même les lignes ci-dessus.
              </p>
            )}
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Prix final pour le client
              </span>
              <span className="font-semibold">
                {finalPrice.toFixed(2)} {currency.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Vous recevrez</span>
              <span className="font-semibold text-green-600">
                {(totalAmount - sellerFees).toFixed(2)} {currency.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ProposalFeeDistribution.displayName = 'ProposalFeeDistribution';
