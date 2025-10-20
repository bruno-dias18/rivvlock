import { useState } from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';

interface FeeDistributionSectionProps {
  baseAmount: number;
  currency: string;
  feeRatio: number;
  onFeeRatioChange: (ratio: number) => void;
  detailedMode?: boolean;
  onAutoDistribute?: () => void;
}

export function FeeDistributionSection({
  baseAmount,
  currency,
  feeRatio,
  onFeeRatioChange,
  detailedMode = false,
  onAutoDistribute,
}: FeeDistributionSectionProps) {
  const [showFeeDetails, setShowFeeDetails] = useState(false);
  const [chargeFeesToClient, setChargeFeesToClient] = useState(false);

  const handleCheckboxChange = (checked: boolean) => {
    setChargeFeesToClient(checked);
    if (!checked) {
      // When unchecked, reset to 0% and trigger auto-distribute to recalculate lines
      onFeeRatioChange(0);
      onAutoDistribute?.();
    } else {
      // When checked, set to minimum 10% and trigger auto-distribute
      onFeeRatioChange(10);
      onAutoDistribute?.();
    }
  };

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
        <div className="flex items-center gap-3">
          <Checkbox
            id="charge-fees-to-client"
            checked={chargeFeesToClient}
            onCheckedChange={handleCheckboxChange}
          />
          <Label 
            htmlFor="charge-fees-to-client" 
            className="text-sm font-medium cursor-pointer"
          >
            Répercuter les frais sur le client
          </Label>
        </div>
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
            Les frais de plateforme RivvLock (5%) couvrent la sécurisation des paiements, 
            le support client et la médiation. Vous pouvez choisir de les répartir entre 
            vous et votre client selon votre stratégie commerciale.
          </AlertDescription>
        </Alert>
      )}

      {chargeFeesToClient && (
        <>
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
              min={1}
              max={100}
              step={1}
              className="w-full"
            />

            {detailedMode && feeRatio > 0 && onAutoDistribute && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAutoDistribute}
                className="w-full"
              >
                Répartir automatiquement les frais sur les lignes
              </Button>
            )}

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
        </>
      )}
    </div>
  );
}
