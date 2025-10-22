import { useState } from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

const PLATFORM_FEE_RATE = 0.05; // 5%

interface Props {
  totalAmount: number;
  currency: string;
  feeRatio: number;
  onFeeRatioChange: (ratio: number) => void;
  onApplyDistribution?: () => void;
  showApplyButton?: boolean;
}

export const FeeDistributionSlider = ({
  totalAmount,
  currency,
  feeRatio,
  onFeeRatioChange,
  onApplyDistribution,
  showApplyButton = false
}: Props) => {
  const [showDetails, setShowDetails] = useState(false);

  const totalFees = totalAmount * PLATFORM_FEE_RATE;
  const clientFees = totalFees * (feeRatio / 100);
  const sellerFees = totalFees * (1 - feeRatio / 100);
  const finalPrice = totalAmount + clientFees;
  const sellerReceives = totalAmount - sellerFees;

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
          onClick={() => setShowDetails(!showDetails)}
        >
          <Info className="h-4 w-4" />
        </Button>
      </div>

      {showDetails && (
        <Alert className="text-xs">
          <AlertDescription>
            <strong>Comment ça marche ?</strong>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Les frais de plateforme (RivvLock + Stripe) sont de <strong>5% du montant TTC</strong></li>
              <li>Vous pouvez choisir qui paie ces frais : vous, le client, ou un partage</li>
              <li>À 0% : vous payez tous les frais</li>
              <li>À 50% : les frais sont partagés équitablement</li>
              <li>À 100% : le client paie tous les frais</li>
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <Slider
            value={[feeRatio]}
            onValueChange={(values) => onFeeRatioChange(values[0])}
            min={0}
            max={100}
            step={5}
            className="flex-1"
          />
          <Badge variant="secondary" className="min-w-[60px] justify-center">
            {feeRatio}%
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="text-muted-foreground">Frais client ({feeRatio}%)</div>
            <div className="font-semibold text-green-600">
              +{clientFees.toFixed(2)} {currency}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">Frais vendeur ({100 - feeRatio}%)</div>
            <div className="font-semibold text-orange-600">
              -{sellerFees.toFixed(2)} {currency}
            </div>
          </div>
        </div>

        <div className="pt-3 border-t">
          <div className="flex justify-between items-center">
            <span className="font-medium">Montant que vous recevrez</span>
            <span className="text-lg font-bold text-green-600">
              {sellerReceives.toFixed(2)} {currency}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Après déduction des frais RivvLock à votre charge
          </p>
        </div>

        {showApplyButton && onApplyDistribution && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onApplyDistribution}
              className="w-full"
            >
              Appliquer la répartition automatique
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              💡 <strong>Astuce :</strong> vous pouvez aussi ajouter manuellement une ligne "Frais de plateforme" ou ajuster les prix ligne par ligne
            </p>
          </>
        )}
      </div>
    </div>
  );
};

