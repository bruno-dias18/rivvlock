import { Badge } from '@/components/ui/badge';

interface KycStatusBadgeProps {
  status: string;
}

export function KycStatusBadge({ status }: KycStatusBadgeProps) {
  switch (status) {
    case 'approved':
      return <Badge className="bg-success">Approuvé</Badge>;
    case 'rejected':
      return <Badge variant="destructive">Rejeté</Badge>;
    case 'in_review':
      return <Badge className="bg-warning">En cours</Badge>;
    case 'additional_info_required':
      return <Badge variant="outline">Info requise</Badge>;
    default:
      return <Badge variant="secondary">En attente</Badge>;
  }
}
