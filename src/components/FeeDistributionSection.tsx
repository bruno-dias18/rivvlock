import { useState } from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

interface FeeDistributionSectionProps {
  baseAmount: number;
  currency: string;
  feeRatio: number;
  onFeeRatioChange: (ratio: number) => void;
}

export function FeeDistributionSection({
  baseAmount,
  currency,
  feeRatio,
  onFeeRatioChange,
}: FeeDistributionSectionProps) {
  const [showFeeDetails, setShowFeeDetails] = useState(false);

  const handleSliderChange = ([value]: number[]) => {
    onFeeRatioChange(value);
  };

  const totalFees = baseAmount * 0.05263;
  const clientFees = totalFees * (feeRatio / 100);
  const sellerFees = totalFees * (1 - feeRatio / 100);
  const finalClientPrice = baseAmount + clientFees;
  const sellerReceives = baseAmount - sellerFees;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Répartition des frais de plateforme (5,263%)
        </span>
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
            Les frais de plateforme RivvLock (5,263%) couvrent la sécurisation des paiements, 
            le support client et la médiation. Déplacez le curseur pour répartir les frais 
            entre vous et votre client : 0% = vous payez tout, 100% = client paie tout.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Pourcentage des frais payés par le client</span>
          <Badge variant="secondary" className="font-mono">
            {feeRatio}%
          </Badge>
        </div>

        <Slider
          id="fee-distribution"
          value={[feeRatio]}
          onValueChange={handleSliderChange}
          min={0}
          max={100}
          step={1}
          className="w-full"
        />

        <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-muted/50">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Frais à charge du client</p>
            <p className="font-semibold text-base">
              {clientFees.toFixed(2)} {currency}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Frais à votre charge</p>
            <p className="font-semibold text-base">
              {sellerFees.toFixed(2)} {currency}
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Prix final pour le client</span>
            <span className="font-medium">
              {finalClientPrice.toFixed(2)} {currency}
            </span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="font-medium">Vous recevrez</span>
            <span className="font-bold text-lg text-green-600">
              {sellerReceives.toFixed(2)} {currency}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
