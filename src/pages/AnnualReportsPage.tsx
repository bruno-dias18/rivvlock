import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardLayoutWithSidebar } from '@/components/layouts/DashboardLayoutWithSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAnnualTransactions } from '@/hooks/useAnnualTransactions';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, FileSpreadsheet, FileArchive, TrendingUp, DollarSign, Hash } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generateAnnualReportPDF, downloadAllInvoicesAsZip } from '@/lib/lazyAnnualReportGenerator';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export default function AnnualReportsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { data: annualData, isLoading } = useAnnualTransactions(parseInt(selectedYear));
  
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  
  const handleGeneratePDF = async () => {
    if (!annualData || !user || !profile) {
      toast.error(t('reports.generationError'));
      return;
    }
    
    setIsGenerating(true);
    try {
      // Fetch invoices for the transactions
      const transactionIds = annualData.transactions.map(t => t.id);
      const { data: invoices } = await supabase
        .from('invoices')
        .select('invoice_number, transaction_id')
        .in('transaction_id', transactionIds);
      
      await generateAnnualReportPDF({
        year: parseInt(selectedYear),
        transactions: annualData.transactions,
        invoices: invoices || [],
        currencyTotals: annualData.currencyTotals,
        currency: annualData.currency,
        sellerProfile: profile,
        sellerEmail: user.email || '',
        language: t('common.language') || 'fr',
        t
      });
      
      toast.success(t('reports.pdfGenerated'));
    } catch (error) {
      logger.error('PDF generation error:', error);
      toast.error(t('reports.generationError'));
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleGenerateExcel = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-annual-report', {
        body: { year: parseInt(selectedYear), format: 'excel' }
      });
      
      if (error) throw error;
      
      // Create blob and download
      const blob = new Blob([data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-annuel-${selectedYear}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success(t('reports.excelGenerated'));
    } catch (error) {
      logger.error('Excel generation error:', error);
      toast.error(t('reports.generationError'));
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleDownloadInvoicesZip = async () => {
    if (!user) {
      toast.error(t('reports.generationError'));
      return;
    }
    
    setIsGenerating(true);
    let toastId: string | number;
    try {
      const count = await downloadAllInvoicesAsZip(
        parseInt(selectedYear),
        user.id,
        i18n.language,
        t,
        (current, total) => {
          const message = t('reports.generatingInvoices').replace('{{count}}', `${current}/${total}`);
          if (toastId) {
            toast.loading(message, { id: toastId });
          } else {
            toastId = toast.loading(message);
          }
        }
      );
      
      toast.dismiss(toastId);
      toast.success(t('reports.invoicesZipGenerated').replace('{{count}}', count.toString()));
    } catch (error) {
      logger.error('ZIP generation error:', error);
      if (toastId) toast.dismiss(toastId);
      toast.error(t('reports.generationError'));
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <DashboardLayoutWithSidebar>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('reports.title')}</h1>
          <p className="text-muted-foreground">{t('reports.description')}</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.selectYear')}</CardTitle>
            <CardDescription>{t('reports.selectYearDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        
        {isLoading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : annualData && Object.keys(annualData.currencyTotals).length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <DollarSign className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-2">{t('reports.totalRevenue')}</p>
                      <div className="space-y-1">
                        {Object.entries(annualData.currencyTotals)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([currency, amount]) => (
                            <p key={currency} className="text-xl font-bold">
                              {amount.toFixed(2)} {currency}
                            </p>
                          ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <Hash className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t('reports.transactionCount')}</p>
                      <p className="text-2xl font-bold">{annualData.transactionCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>{t('reports.exportTitle')}</CardTitle>
                <CardDescription>{t('reports.exportDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-4">
            <Button 
              onClick={handleGeneratePDF}
              disabled={isGenerating}
              variant="outline"
              className="flex items-center justify-center gap-2 w-full sm:w-auto"
            >
                  <FileText className="h-4 w-4" />
                  {t('reports.downloadPDF')}
                </Button>
                
                <Button 
                  onClick={handleGenerateExcel}
                  disabled={isGenerating}
                  variant="outline"
                  className="flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {t('reports.downloadExcel')}
                </Button>
                
                <Button 
                  onClick={handleDownloadInvoicesZip}
                  disabled={isGenerating}
                  variant="outline"
                  className="flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <FileArchive className="h-4 w-4" />
                  {t('reports.downloadInvoicesZip')}
                </Button>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">{t('reports.noData')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayoutWithSidebar>
  );
}
