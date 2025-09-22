import React from 'react';
import { useState, useEffect } from 'react';
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
  Copy,
  User,
  RefreshCw,
  Timer,
  Banknote,
  CheckCheck,
  Download
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAppBaseUrl } from '@/lib/appUrl';
import { generateSellerInvoice, generateBuyerInvoice, downloadInvoice } from '@/components/invoice/AutoInvoiceGenerator';

export const Transactions = () => {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { transactions, refreshTransactions } = useTransactions();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await refreshTransactions();
      toast({
        title: "Actualisé",
        description: "Liste des transactions mise à jour",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'actualiser les transactions",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copié !",
        description: "Lien copié dans le presse-papiers",
      });
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: "Erreur",
        description: "Impossible de copier le lien",
        variant: "destructive",
      });
    }
  };

  const downloadTransactionInvoice = async (transaction: any, type: 'seller' | 'buyer') => {
    try {
      // Create a basic user profile for invoice generation
      const basicProfile = {
        user_id: user?.id || '',
        user_type: 'individual' as const,
        email: user?.email || '',
        first_name: '',
        last_name: '',
        country: 'FR' as const,
        verified: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const invoice = type === 'seller' 
        ? await generateSellerInvoice(transaction, basicProfile, transaction.currency)
        : await generateBuyerInvoice(transaction, basicProfile, transaction.currency);
      
      downloadInvoice(invoice, `${type}-invoice-${transaction.id.slice(0, 8)}.pdf`);
      
      toast({
        title: "Facture téléchargée",
        description: `Facture ${type === 'seller' ? 'vendeur' : 'acheteur'} générée avec succès`,
      });
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast({
        title: "Erreur",
        description: "Impossible de générer la facture",
        variant: "destructive",
      });
    }
  };

  const statusConfig = {
    pending: {
      badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: Clock,
      color: 'text-yellow-600'
    },
    paid: {
      badge: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: CheckCircle,
      color: 'text-blue-600'
    },
    validated: {
      badge: 'bg-green-100 text-green-800 border-green-200',
      icon: CheckCheck,
      color: 'text-green-600'
    },
    disputed: {
      badge: 'bg-red-100 text-red-800 border-red-200',
      icon: AlertTriangle,
      color: 'text-red-600'
    }
  };

  const statusCounts = transactions.reduce((acc, transaction) => {
    const status = transaction.status || 'pending';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {
    pending: 0,
    paid: 0,
    validated: 0,
    disputed: 0,
  });

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = !searchTerm || 
      transaction.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Mes Transactions</h1>
            <p className="text-muted-foreground">
              Gérez vos transactions sécurisées
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleRefresh}
              variant="outline"
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Button onClick={() => navigate('/create-transaction')} className="gradient-primary text-white">
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle Transaction
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { key: 'pending', label: 'En attente', count: statusCounts.pending, color: 'text-yellow-600' },
            { key: 'paid', label: 'Payées', count: statusCounts.paid, color: 'text-blue-600' },
            { key: 'validated', label: 'Complétées', count: statusCounts.validated, color: 'text-green-600' },
            { key: 'disputed', label: 'En litige', count: statusCounts.disputed, color: 'text-red-600' },
          ].map((stat) => (
            <Card 
              key={stat.key}
              className={`transition-all duration-200 cursor-pointer hover:shadow-md ${
                statusFilter === stat.key ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setStatusFilter(statusFilter === stat.key ? 'all' : stat.key)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
                  </div>
                  <div className={`p-2 rounded-full bg-muted ${stat.color}`}>
                    {React.createElement(statusConfig[stat.key]?.icon || Clock, { className: "w-4 h-4" })}
                  </div>
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
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Rechercher par titre ou description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filtrer par statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="paid">Payées</SelectItem>
                    <SelectItem value="validated">Complétées</SelectItem>
                    <SelectItem value="disputed">En litige</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions List */}
        <div className="space-y-4">
          {filteredTransactions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucune transaction trouvée</h3>
                <p className="text-muted-foreground mb-4">
                  {transactions.length === 0 
                    ? "Vous n'avez pas encore de transactions."
                    : "Aucune transaction ne correspond à vos critères de recherche."
                  }
                </p>
                {transactions.length === 0 && (
                  <Button onClick={() => navigate('/create-transaction')} className="gradient-primary text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Créer ma première transaction
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredTransactions.map((transaction) => {
              const status = transaction.status || 'pending';
              const config = statusConfig[status] || statusConfig.pending;
              const Icon = config.icon;
              
              const isUserSeller = transaction.user_id === user?.id;
              const userRole = isUserSeller ? 'seller' : 'buyer';
              
              return (
                <Card key={transaction.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{transaction.title}</h3>
                          <Badge className={config.badge}>
                            <Icon className="w-3 h-3 mr-1" />
                            {status === 'pending' ? 'En attente' :
                             status === 'paid' ? 'Payé' :
                             status === 'validated' ? 'Complété' :
                             status === 'disputed' ? 'En litige' : status}
                          </Badge>
                        </div>
                        
                        <p className="text-muted-foreground text-sm mb-3">
                          {transaction.description || 'Aucune description'}
                        </p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Montant:</span>
                            <p className="font-semibold">
                              {formatAmount(transaction.price, transaction.currency as 'EUR' | 'CHF')}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Rôle:</span>
                            <p className="font-semibold capitalize">
                              {isUserSeller ? 'Vendeur' : 'Acheteur'}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Date de service:</span>
                            <p className="font-semibold">
                              {transaction.service_date ? 
                                format(new Date(transaction.service_date), 'dd MMM yyyy', { locale: fr }) : 
                                'Non définie'
                              }
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Créé le:</span>
                            <p className="font-semibold">
                              {format(new Date(transaction.created_at), 'dd MMM yyyy', { locale: fr })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 pt-4 border-t">
                      <Button
                        onClick={() => downloadTransactionInvoice(transaction, userRole)}
                        size="sm"
                        variant="outline"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Télécharger Facture
                      </Button>
                      
                      <Button
                        onClick={() => copyToClipboard(`${getAppBaseUrl()}/transactions/${transaction.id}`)}
                        size="sm"
                        variant="outline"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copier Lien
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </Layout>
  );
};