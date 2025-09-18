import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrency } from '@/hooks/useCurrency';
import { 
  Plus, 
  Search, 
  Filter, 
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  CreditCard
} from 'lucide-react';

// Mock transactions data
const mockTransactions = [
  {
    id: 'TX001',
    title: 'Consultation IT - Mise en place infrastructure cloud',
    description: 'Services de consultation technique pour migration AWS',
    amount: 2500,
    currency: 'EUR' as const,
    serviceDate: '2024-01-15T10:00:00Z',
    status: 'validated' as const,
    createdAt: '2024-01-10T14:30:00Z',
    client: 'Innovation Labs SA',
  },
  {
    id: 'TX002',
    title: 'Formation React Advanced',
    description: 'Formation développement web avancé sur 3 jours',
    amount: 1800,
    currency: 'CHF' as const,
    serviceDate: '2024-01-20T09:00:00Z',
    status: 'pending' as const,
    createdAt: '2024-01-12T16:15:00Z',
    client: 'Tech Academy',
  },
  {
    id: 'TX003',
    title: 'Audit sécurité informatique complet',
    description: 'Audit de sécurité et recommandations',
    amount: 3200,
    currency: 'EUR' as const,
    serviceDate: '2024-01-10T14:00:00Z',
    status: 'disputed' as const,
    createdAt: '2024-01-08T11:20:00Z',
    client: 'SecureCorp',
  },
  {
    id: 'TX004',
    title: 'Développement application mobile',
    description: 'Application React Native pour gestion commandes',
    amount: 5500,
    currency: 'EUR' as const,
    serviceDate: '2024-02-01T10:00:00Z',
    status: 'paid' as const,
    createdAt: '2024-01-05T09:45:00Z',
    client: 'Retail Solutions',
  },
  {
    id: 'TX005',
    title: 'Maintenance serveurs',
    description: 'Maintenance mensuelle infrastructure serveurs',
    amount: 800,
    currency: 'CHF' as const,
    serviceDate: '2024-01-25T08:00:00Z',
    status: 'pending' as const,
    createdAt: '2024-01-20T13:00:00Z',
    client: 'Alpine Systems',
  },
];

export const Transactions = () => {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredTransactions = mockTransactions.filter(transaction => {
    const matchesSearch = transaction.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.client.toLowerCase().includes(searchTerm.toLowerCase());
    
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
      all: mockTransactions.length,
      pending: mockTransactions.filter(t => t.status === 'pending').length,
      validated: mockTransactions.filter(t => t.status === 'validated').length,
      paid: mockTransactions.filter(t => t.status === 'paid').length,
      disputed: mockTransactions.filter(t => t.status === 'disputed').length,
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
          <Button className="gradient-primary text-white">
            <Plus className="w-4 h-4 mr-2" />
            {t('transactions.new')}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { key: 'all', label: 'Total', count: statusCounts.all, color: 'text-gray-600' },
            { key: 'pending', label: t('transactions.pending'), count: statusCounts.pending, color: 'text-yellow-600' },
            { key: 'validated', label: t('transactions.validated'), count: statusCounts.validated, color: 'text-green-600' },
            { key: 'paid', label: t('transactions.paid'), count: statusCounts.paid, color: 'text-blue-600' },
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
                    <SelectItem value="validated">{t('transactions.validated')}</SelectItem>
                    <SelectItem value="paid">{t('transactions.paid')}</SelectItem>
                    <SelectItem value="disputed">{t('transactions.disputed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions List */}
        <div className="space-y-4">
          {filteredTransactions.map((transaction) => {
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
                            ID: {transaction.id}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-foreground">
                            {formatAmount(transaction.amount, transaction.currency)}
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
                          <strong>Client:</strong> {transaction.client}
                        </div>
                        <div>
                          <strong>Service:</strong> {new Date(transaction.serviceDate).toLocaleDateString()}
                        </div>
                        <div>
                          <strong>Créé:</strong> {new Date(transaction.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-2" />
                          {t('transactions.details')}
                        </Button>
                        {transaction.status === 'pending' && (
                          <Button size="sm" className="gradient-success text-white">
                            Valider
                          </Button>
                        )}
                        {transaction.status === 'disputed' && (
                          <Button size="sm" variant="destructive">
                            Résoudre le litige
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredTransactions.length === 0 && (
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
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};