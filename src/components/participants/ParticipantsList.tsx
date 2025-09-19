import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCurrency } from '@/hooks/useCurrency';
import { useParticipants, type Participant } from '@/hooks/useParticipants';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Users, 
  ShoppingCart, 
  Store, 
  ArrowRight,
  Calendar,
  Euro,
  Loader2
} from 'lucide-react';

interface ParticipantsListProps {
  className?: string;
}

export const ParticipantsList = ({ className }: ParticipantsListProps) => {
  const { participants, buyers, sellers, loading, error, getDisplayName } = useParticipants();
  const { formatAmount } = useCurrency();

  const getInitials = (profile: Participant['profile']): string => {
    if (profile.user_type === 'company' && profile.company_name) {
      return profile.company_name.slice(0, 2).toUpperCase();
    }
    
    const firstName = profile.first_name || '';
    const lastName = profile.last_name || '';
    
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    
    return 'U';
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'validated': return 'default';
      case 'paid': return 'secondary';
      case 'pending': return 'outline';
      case 'disputed': return 'destructive';
      default: return 'outline';
    }
  };

  const renderParticipantCard = (participant: Participant) => (
    <Card key={participant.user_id} className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="gradient-primary text-white text-sm font-medium">
              {getInitials(participant.profile)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm truncate">
                {getDisplayName(participant.profile)}
              </h4>
              <Badge variant="outline" className="text-xs">
                {participant.profile.user_type === 'company' ? 'Entreprise' : 'Particulier'}
              </Badge>
            </div>
            
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <ArrowRight className="w-3 h-3" />
                <span>{participant.transactions_count} transaction(s)</span>
              </div>
              <div className="flex items-center gap-1">
                <Euro className="w-3 h-3" />
                <span>{formatAmount(participant.total_amount)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>
                  Il y a {formatDistanceToNow(new Date(participant.last_transaction_date), { locale: fr })}
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1">
              {participant.transactions.slice(0, 3).map((transaction) => (
                <Badge
                  key={transaction.id}
                  variant={getStatusBadgeVariant(transaction.status)}
                  className="text-xs"
                >
                  {formatAmount(transaction.price)}
                </Badge>
              ))}
              {participant.transactions.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{participant.transactions.length - 3}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Chargement des partenaires...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center p-8 ${className}`}>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className={`text-center p-8 ${className}`}>
        <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Aucun partenaire trouvé</p>
        <p className="text-xs text-muted-foreground mt-1">
          Vos partenaires d'affaires apparaîtront ici après vos premières transactions.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <Tabs defaultValue="sellers" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sellers" className="flex items-center gap-2">
            <Store className="w-4 h-4" />
            En tant qu'Acheteur ({sellers.length})
          </TabsTrigger>
          <TabsTrigger value="buyers" className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            En tant que Vendeur ({buyers.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="sellers" className="space-y-3 mt-4">
          {sellers.length > 0 ? (
            sellers.map(renderParticipantCard)
          ) : (
            <div className="text-center p-8">
              <Store className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucun vendeur</p>
              <p className="text-xs text-muted-foreground mt-1">
                Les vendeurs auprès desquels vous avez acheté apparaîtront ici.
              </p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="buyers" className="space-y-3 mt-4">
          {buyers.length > 0 ? (
            buyers.map(renderParticipantCard)
          ) : (
            <div className="text-center p-8">
              <ShoppingCart className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucun acheteur</p>
              <p className="text-xs text-muted-foreground mt-1">
                Les acheteurs qui ont acheté chez vous apparaîtront ici.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};