import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Filter, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardLayoutWithSidebar } from '@/components/layouts/DashboardLayoutWithSidebar';
import { AdminDisputeCard } from '@/components/AdminDisputeCard';
import { VirtualDisputeList } from '@/components/VirtualDisputeList';
import { useAdminDisputes, useAdminDisputeStats } from '@/hooks/useAdminDisputes';
import { useAdminDisputeNotifications } from '@/hooks/useAdminDisputeNotifications';
import { useUnreadDisputesGlobal } from '@/hooks/useUnreadDisputesGlobal';
import { useUnreadAdminMessages } from '@/hooks/useUnreadAdminMessages';

export default function AdminDisputesPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const { data: disputes, isLoading, refetch } = useAdminDisputes(statusFilter);
  const { data: stats, isLoading: statsLoading } = useAdminDisputeStats();
  
  // Hook pour les notifications de litiges escaladés
  const { markAsSeen } = useAdminDisputeNotifications();
  const { markAllAsSeen } = useUnreadDisputesGlobal();
  
  // Compteur de messages admin non lus
  const { unreadCount: adminUnreadCount } = useUnreadAdminMessages();
  
  // Marquer comme vu quand l'utilisateur visite la page avec le filtre escalated
  useEffect(() => {
    if (statusFilter === 'escalated') {
      markAsSeen();
    }
  }, [statusFilter, markAsSeen]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'negotiating':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'escalated':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <DashboardLayoutWithSidebar>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-8 w-8" />
            Gestion des Litiges
          </h1>
          <h2 className="text-lg font-semibold mt-1">Tous les litiges</h2>
          <p className="text-muted-foreground">
            Administration et résolution des litiges clients
          </p>
        </div>

        {/* Alerte pour les litiges escaladés */}
        {!statsLoading && stats && stats.escalated > 0 && (
          <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="relative">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-1">
                    {stats.escalated} litige{stats.escalated > 1 ? 's escaladés' : ' escaladé'} nécessite{stats.escalated > 1 ? 'nt' : ''} votre attention
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Ces litiges n'ont pas pu être résolus à l'amiable et nécessitent une intervention manuelle pour arbitrage.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="mt-3 border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                    onClick={() => setStatusFilter('escalated')}
                  >
                    Voir les litiges escaladés
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {statsLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-16" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-12" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <Card 
                className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.total || 0}</div>
                </CardContent>
              </Card>
              <Card 
                className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'open' ? 'ring-2 ring-red-600' : ''}`}
                onClick={() => setStatusFilter('open')}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Ouverts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stats?.open || 0}</div>
                </CardContent>
              </Card>
              <Card 
                className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'negotiating' ? 'ring-2 ring-yellow-600' : ''}`}
                onClick={() => setStatusFilter('negotiating')}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    En négociation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{stats?.negotiating || 0}</div>
                </CardContent>
              </Card>
              <Card 
                className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'escalated' ? 'ring-2 ring-purple-600' : ''}`}
                onClick={() => setStatusFilter('escalated')}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    Escaladés
                    {adminUnreadCount > 0 && (
                      <Badge variant="destructive" className="ml-auto">
                        {adminUnreadCount}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{stats?.escalated || 0}</div>
                </CardContent>
              </Card>
              <Card 
                className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'resolved' ? 'ring-2 ring-green-600' : ''}`}
                onClick={() => setStatusFilter('resolved')}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Résolus
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats?.resolved || 0}</div>
                </CardContent>
              </Card>
              <Card 
                className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'recent' ? 'ring-2 ring-blue-600' : ''}`}
                onClick={() => setStatusFilter('recent')}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Récents (30j)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{stats?.recent || 0}</div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Statut:</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="open">Ouverts</SelectItem>
                    <SelectItem value="negotiating">En négociation</SelectItem>
                    <SelectItem value="responded">Vendeur a répondu</SelectItem>
                    <SelectItem value="escalated">Escaladés</SelectItem>
                    <SelectItem value="resolved_refund">Résolus - Remboursement</SelectItem>
                    <SelectItem value="resolved_release">Résolus - Fonds libérés</SelectItem>
                    <SelectItem value="recent">Récents (30j)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                variant="outline" 
                onClick={() => refetch()}
                className="flex items-center gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                Actualiser
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Disputes List */}
        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-64" />
                  <Skeleton className="h-4 w-96" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            ))
          ) : disputes && disputes.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  {disputes.length} litige{disputes.length > 1 ? 's' : ''} trouvé{disputes.length > 1 ? 's' : ''}
                </h2>
                <Badge variant="outline" className={getStatusColor(statusFilter)}>
                  {statusFilter === 'all' ? 'Tous' : statusFilter}
                </Badge>
              </div>
              {disputes.length > 10 ? (
                <VirtualDisputeList disputes={disputes} onRefetch={refetch} />
              ) : (
                disputes.map((dispute) => (
                  <AdminDisputeCard
                    key={dispute.id}
                    dispute={dispute}
                    onRefetch={refetch}
                  />
                ))
              )}
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucun litige trouvé</h3>
                <p className="text-muted-foreground">
                  {statusFilter === 'all' 
                    ? "Il n'y a actuellement aucun litige dans le système."
                    : `Aucun litige avec le statut "${statusFilter}" n'a été trouvé.`
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayoutWithSidebar>
  );
}