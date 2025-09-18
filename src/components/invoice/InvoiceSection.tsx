import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { generateInvoicesForTransaction, downloadInvoice } from './AutoInvoiceGenerator';
import { 
  FileText, 
  Download, 
  Loader2,
  Receipt,
  Calendar,
  DollarSign
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Transaction {
  id: string;
  title: string;
  price: number;
  currency: string;
  service_date: string;
  created_at: string;
  status: string;
  user_id: string;
  buyer_id?: string;
}

interface StoredInvoice {
  id: string;
  transaction_id: string;
  user_id: string;
  invoice_type: 'seller' | 'buyer';
  invoice_data: string;
  filename: string;
  created_at: string;
}

export const InvoiceSection = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [storedInvoices, setStoredInvoices] = useState<StoredInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingInvoices, setGeneratingInvoices] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchUserTransactions();
      fetchStoredInvoices();
    }
  }, [user]);

  const fetchUserTransactions = async () => {
    if (!user) return;

    try {
      // Get transactions where user is either seller or buyer
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`user_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .in('status', ['paid', 'validated'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Erreur chargement transactions:', error);
    }
  };

  const fetchStoredInvoices = async () => {
    if (!user) return;

    try {
      // This would be a custom table to store invoice metadata
      // For now, we'll simulate this functionality
      setStoredInvoices([]);
    } catch (error) {
      console.error('Erreur chargement factures:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvoice = async (transaction: Transaction) => {
    if (!user) return;

    setGeneratingInvoices(prev => new Set(prev).add(transaction.id));

    try {
      const invoices = await generateInvoicesForTransaction(transaction.id);
      
      // Find the invoice for the current user
      const userInvoice = invoices.find(invoice => invoice.user_id === user.id);
      
      if (userInvoice) {
        // Download the invoice immediately
        downloadInvoice(userInvoice.data, userInvoice.filename);
        
        // In a real implementation, you would store the invoice metadata
        console.log(`✅ Facture générée: ${userInvoice.filename}`);
      }
    } catch (error) {
      console.error('Erreur génération facture:', error);
    } finally {
      setGeneratingInvoices(prev => {
        const newSet = new Set(prev);
        newSet.delete(transaction.id);
        return newSet;
      });
    }
  };

  const getUserRole = (transaction: Transaction): 'seller' | 'buyer' | null => {
    if (!user) return null;
    if (transaction.user_id === user.id) return 'seller';
    if (transaction.buyer_id === user.id) return 'buyer';
    return null;
  };

  const getInvoiceTitle = (transaction: Transaction): string => {
    const role = getUserRole(transaction);
    if (role === 'seller') return 'Facture Vendeur';
    if (role === 'buyer') return 'Reçu Acheteur';
    return 'Facture';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span>Chargement des factures...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Factures et Reçus
        </CardTitle>
        <CardDescription>
          Générez et téléchargez vos factures pour les transactions payées
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">
                Aucune transaction payée disponible pour génération de facture
              </p>
            </div>
          ) : (
            transactions.map((transaction) => {
              const role = getUserRole(transaction);
              if (!role) return null;

              const isGenerating = generatingInvoices.has(transaction.id);

              return (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">{transaction.title}</h3>
                      <Badge variant={role === 'seller' ? 'default' : 'secondary'}>
                        {role === 'seller' ? 'Vendeur' : 'Acheteur'}
                      </Badge>
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        {transaction.status === 'validated' ? 'Terminée' : 'Payée'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        <span>{transaction.price} {transaction.currency}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Service: {format(new Date(transaction.service_date), 'PPP', { locale: fr })}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateInvoice(transaction)}
                      disabled={isGenerating}
                      className="flex items-center gap-2"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      {isGenerating ? 'Génération...' : `Télécharger ${getInvoiceTitle(transaction)}`}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {transactions.length > 0 && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">ℹ️ Informations importantes</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Les factures vendeur incluent le montant net après déduction des frais RIVVLOCK (5%)</li>
              <li>• Les reçus acheteur montrent le montant total payé incluant les frais</li>
              <li>• Les factures sont générées automatiquement après paiement validé</li>
              <li>• Format PDF compatible avec les exigences comptables</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};