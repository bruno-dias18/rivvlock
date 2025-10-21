import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface ProposalClientInfoProps {
  clientEmail: string;
  clientName: string;
  onClientEmailChange: (value: string) => void;
  onClientNameChange: (value: string) => void;
}

/**
 * Sous-composant pour les informations client
 * Mémoïsé pour éviter les re-renders inutiles
 */
export const ProposalClientInfo = React.memo(
  ({
    clientEmail,
    clientName,
    onClientEmailChange,
    onClientNameChange,
  }: ProposalClientInfoProps) => {
    return (
      <div className="space-y-4">
        <h3 className="font-medium">Informations client</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="client-email">Email client *</Label>
            <Input
              id="client-email"
              type="email"
              value={clientEmail}
              onChange={(e) => onClientEmailChange(e.target.value)}
              placeholder="client@example.com"
              required
            />
          </div>
          <div>
            <Label htmlFor="client-name">Nom client</Label>
            <Input
              id="client-name"
              value={clientName}
              onChange={(e) => onClientNameChange(e.target.value)}
              placeholder="Jean Dupont"
            />
          </div>
        </div>
      </div>
    );
  }
);

ProposalClientInfo.displayName = 'ProposalClientInfo';
