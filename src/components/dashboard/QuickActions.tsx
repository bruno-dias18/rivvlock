import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, TestTube, FileText, Users, CreditCard, Settings } from 'lucide-react';

export const QuickActions = () => {
  const navigate = useNavigate();

  const actions = [
    {
      title: 'Créer une transaction',
      description: 'Nouvelle transaction escrow avec lien d\'invitation',
      icon: <Plus className="w-5 h-5" />,
      action: () => navigate('/create-transaction'),
      variant: 'primary' as const,
      badge: 'Principal'
    },
    {
      title: 'Tests & Validation',
      description: 'Tester le système complet avec guide utilisateur',
      icon: <TestTube className="w-5 h-5" />,
      action: () => navigate('/test'),
      variant: 'secondary' as const,
      badge: 'Nouveau'
    },
    {
      title: 'Mes transactions',
      description: 'Voir toutes vos transactions en cours',
      icon: <FileText className="w-5 h-5" />,
      action: () => navigate('/transactions'),
      variant: 'outline' as const
    },
    {
      title: 'Profil utilisateur',
      description: 'Gérer vos informations personnelles',
      icon: <Users className="w-5 h-5" />,
      action: () => navigate('/profile'),
      variant: 'outline' as const
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions rapides</CardTitle>
        <CardDescription>
          Accès direct aux fonctionnalités principales de RIVVLOCK
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actions.map((action, index) => (
          <div key={index} className="relative group">
            <Button
              onClick={action.action}
              variant={action.variant === 'primary' ? 'default' : action.variant}
              className="w-full h-auto p-4 flex-col items-start space-y-2 group-hover:scale-[1.02] transition-transform"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  {action.icon}
                  <span className="font-semibold">{action.title}</span>
                </div>
                {action.badge && (
                  <Badge variant="secondary" className="text-xs">
                    {action.badge}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-left opacity-80">
                {action.description}
              </p>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};