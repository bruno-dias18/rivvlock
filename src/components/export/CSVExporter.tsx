import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface CSVExporterProps {
  className?: string;
}

export const CSVExporter = ({ className }: CSVExporterProps) => {
  const { toast } = useToast();

  const exportToCSV = async () => {
    try {
      toast({
        title: 'Export en cours...',
        description: 'Récupération des données...',
      });

      // Fetch all transactions with related data
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select(`
          *,
          disputes(*)
        `)
        .order('created_at', { ascending: false });

      if (transactionsError) throw transactionsError;

      // Get user profiles for seller/buyer names
      const userIds = new Set<string>();
      transactions?.forEach(tx => {
        if (tx.user_id) userIds.add(tx.user_id);
        if (tx.buyer_id) userIds.add(tx.buyer_id);
      });

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, company_name')
        .in('user_id', Array.from(userIds));

      if (profilesError) console.error('Error fetching profiles:', profilesError);

      // Create a map of user profiles
      const profileMap = new Map();
      profiles?.forEach(profile => {
        profileMap.set(profile.user_id, profile);
      });

      // Transform data for CSV
      const csvData = transactions?.map(tx => {
        const sellerProfile = profileMap.get(tx.user_id);
        const buyerProfile = profileMap.get(tx.buyer_id);
        
        const sellerName = sellerProfile?.company_name || 
          `${sellerProfile?.first_name || ''} ${sellerProfile?.last_name || ''}`.trim() || 
          'N/A';
          
        const buyerName = buyerProfile?.company_name || 
          `${buyerProfile?.first_name || ''} ${buyerProfile?.last_name || ''}`.trim() || 
          'N/A';

        const platformFee = tx.price * 0.05;
        const netAmount = tx.price - platformFee;

        return {
          'ID Transaction': tx.id,
          'Titre': tx.title,
          'Description': tx.description || '',
          'Vendeur': sellerName,
          'Acheteur': buyerName,
          'Prix (€)': tx.price,
          'Devise': tx.currency,
          'Frais Plateforme (€)': platformFee.toFixed(2),
          'Net Vendeur (€)': netAmount.toFixed(2),
          'Status': tx.status,
          'Date Création': format(new Date(tx.created_at), 'dd/MM/yyyy HH:mm', { locale: fr }),
          'Date Service': tx.service_date ? format(new Date(tx.service_date), 'dd/MM/yyyy', { locale: fr }) : '',
          'Fonds Libérés': tx.funds_released ? 'Oui' : 'Non',
          'Vendeur Validé': tx.seller_validated ? 'Oui' : 'Non',
          'Acheteur Validé': tx.buyer_validated ? 'Oui' : 'Non',
          'Méthode Paiement': tx.payment_method || '',
          'Date Limite Paiement': tx.payment_deadline ? format(new Date(tx.payment_deadline), 'dd/MM/yyyy HH:mm', { locale: fr }) : '',
          'Date Limite Validation': tx.validation_deadline ? format(new Date(tx.validation_deadline), 'dd/MM/yyyy HH:mm', { locale: fr }) : '',
          'A des Litiges': 'Non',
          'Nombre Litiges': 0,
          'Dernière MAJ': format(new Date(tx.updated_at), 'dd/MM/yyyy HH:mm', { locale: fr }),
        };
      }) || [];

      // Generate CSV
      const csv = Papa.unparse(csvData, {
        delimiter: ';', // Use semicolon for European Excel compatibility
        header: true,
      });

      // Create and download file
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `RIVVLOCK_Export_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: '✅ Export réussi !',
        description: `${csvData.length} transactions exportées vers CSV.`,
      });

    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur d\'export',
        description: 'Impossible d\'exporter les données.',
      });
    }
  };

  return (
    <Button 
      onClick={exportToCSV}
      className={`gradient-success text-white ${className}`}
    >
      <Download className="w-4 h-4 mr-2" />
      Exporter CSV
    </Button>
  );
};