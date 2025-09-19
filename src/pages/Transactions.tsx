import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTransactions } from '@/hooks/useTransactions';
import { useCurrency } from '@/hooks/useCurrency';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Plus, 
  Search, 
  Filter, 
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  CreditCard,
  ExternalLink,
  Link,
  Copy
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Remove mock transactions data - now using real data from useTransactions hook

export const Transactions = () => {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { transactions, loading, error, refreshTransactions } = useTransactions();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();

  const copyInvitationLink = async (token: string) => {
    try {
      const invitationLink = `${import.meta.env.VITE_APP_URL || window.location.origin}/join-transaction/${token}`;
      await navigator.clipboard.writeText(invitationLink);
      toast({
        title: "Lien copié !",
        description: "Le lien d'invitation a été copié dans le presse-papiers.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de copier le lien. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusConfig = (status: string) => {
    const configs = {
      pending: {
        badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: Clock,
        color: 'text-yellow-600'
      },
      validated: {
        badge: 'bg-green-100 text-green-800 border-green-200',
        icon: CheckCircle,
        color: 'text-green-600'
      },
      paid: {
        badge: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: CheckCircle,
        color: 'text-blue-600'
      },
      disputed: {
        badge: 'bg-red-100 text-red-800 border-red-200',
        icon: AlertTriangle,
        color: 'text-red-600'
      }
    };
    
    return configs[status as keyof typeof configs] || configs.pending;
  };

  const getStatusCounts = () => {
    return {
      all: transactions.length,
      pending: transactions.filter(t => t.status === 'pending').length,
      paid: transactions.filter(t => t.status === 'paid').length,
      validated: transactions.filter(t => t.status === 'validated').length,
      disputed: transactions.filter(t => t.status === 'disputed').length,
    };
  };

  const statusCounts = getStatusCounts();

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {t('transactions.title')}
            </h1>
            <p className="text-muted-foreground mt-1">
              Gérez toutes vos transactions escrow
            </p>
          </div>
          <Button 
            className="gradient-primary text-white"
            onClick={() => navigate('/create-transaction')}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('transactions.new')}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { key: 'all', label: 'Total', count: statusCounts.all, color: 'text-gray-600' },
            { key: 'pending', label: t('transactions.pending'), count: statusCounts.pending, color: 'text-yellow-600' },
            { key: 'paid', label: t('transactions.paid'), count: statusCounts.paid, color: 'text-blue-600' },
            { key: 'validated', label: 'Complétées', count: statusCounts.validated, color: 'text-green-600' },
            { key: 'disputed', label: t('transactions.disputed'), count: statusCounts.disputed, color: 'text-red-600' },
          ].map((stat) => (
            <Card 
              key={stat.key}
              className={`cursor-pointer transition-all hover:shadow-md ${
                statusFilter === stat.key ? 'border-primary bg-primary/5' : ''
              }`}
              onClick={() => setStatusFilter(stat.key)}
            >
              <CardContent className="p-4 text-center">
                <div className={`text-2xl font-bold ${stat.color}`}>
                  {stat.count}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stat.label}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher une transaction..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filtrer par statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="pending">{t('transactions.pending')}</SelectItem>
                    <SelectItem value="paid">{t('transactions.paid')}</SelectItem>
                    <SelectItem value="validated">Complétées</SelectItem>
                    <SelectItem value="disputed">{t('transactions.disputed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions List */}
        <div className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Chargement des transactions...</p>
              </CardContent>
            </Card>
          ) : error ? (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                <p className="text-red-600 mb-4">{error}</p>
                <Button onClick={() => refreshTransactions()}>Réessayer</Button>
              </CardContent>
            </Card>
          ) : (
            filteredTransactions.map((transaction) => {
              const statusConfig = getStatusConfig(transaction.status);
              const StatusIcon = statusConfig.icon;
              
              return (
                <Card key={transaction.id} className="hover:shadow-md transition-all duration-200">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-3">
                              <h3 className="font-semibold text-lg">{transaction.title}</h3>
                              <Badge className={statusConfig.badge}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {t(`transactions.${transaction.status}`)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              ID: {transaction.id.substring(0, 8).toUpperCase()}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-foreground">
                              {formatAmount(transaction.price, transaction.currency)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {transaction.currency}
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-muted-foreground">
                          {transaction.description}
                        </p>

                        {/* Details */}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <div>
                            <strong>Service:</strong> {format(new Date(transaction.service_date), 'PPP', { locale: fr })}
                          </div>
                          <div>
                            <strong>Créé:</strong> {format(new Date(transaction.created_at), 'PPP', { locale: fr })}
                          </div>
                          {transaction.payment_deadline && (
                            <div>
                              <strong>Paiement avant:</strong> {format(new Date(transaction.payment_deadline), 'PPP', { locale: fr })}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              if (transaction.shared_link_token) {
                                const detailsLink = `${import.meta.env.VITE_APP_URL || window.location.origin}/join-transaction/${transaction.shared_link_token}`;
                                window.open(detailsLink, '_blank');
                              }
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Voir détails
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => copyInvitationLink(transaction.shared_link_token)}
                            disabled={!transaction.shared_link_token}
                          >
                            <Link className="w-4 h-4 mr-2" />
                            Copier le lien
                          </Button>

                          {transaction.status === 'pending' && (
                            <Button 
                              size="sm" 
                              className="gradient-success text-white"
                              onClick={() => {
                                if (transaction.shared_link_token) {
                                  const paymentLink = `${import.meta.env.VITE_APP_URL || window.location.origin}/payment-link/${transaction.shared_link_token}`;
                                  window.open(paymentLink, '_blank');
                                }
                              }}
                            >
                              <CreditCard className="w-4 h-4 mr-2" />
                              Accéder au paiement
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Empty State */}
        {!loading && !error && filteredTransactions.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">
                  Aucune transaction trouvée
                </p>
                <p className="text-sm">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'Essayez de modifier vos critères de recherche'
                    : 'Créez votre première transaction pour commencer'
                  }
                </p>
                {!searchTerm && statusFilter === 'all' && (
                  <Button 
                    className="mt-4 gradient-primary text-white"
                    onClick={() => navigate('/create-transaction')}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Créer une transaction
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};