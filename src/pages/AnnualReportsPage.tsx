import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAnnualTransactions } from '@/hooks/useAnnualTransactions';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, FileSpreadsheet, TrendingUp, DollarSign, Hash } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function AnnualReportsPage() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { data: annualData, isLoading } = useAnnualTransactions(parseInt(selectedYear));
  
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  
  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-annual-report', {
        body: { year: parseInt(selectedYear), format: 'pdf' }
      });
      
      if (error) throw error;
      
      // Create blob and download
      const blob = new Blob([data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-annuel-${selectedYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success(t('reports.pdfGenerated'));
    } catch (error) {
      console.error('PDF generation error:', error);
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
      console.error('Excel generation error:', error);
      toast.error(t('reports.generationError'));
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <DashboardLayout>
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
        ) : annualData && annualData.totalRevenue > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <DollarSign className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t('reports.totalRevenue')}</p>
                      <p className="text-2xl font-bold">
                        {annualData.totalRevenue.toFixed(2)} {annualData.currency}
                      </p>
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
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t('reports.averageTransaction')}</p>
                      <p className="text-2xl font-bold">
                        {annualData.averageTransaction.toFixed(2)} {annualData.currency}
                      </p>
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
              <CardContent className="flex gap-4">
                <Button 
                  onClick={handleGeneratePDF}
                  disabled={isGenerating}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  {t('reports.downloadPDF')}
                </Button>
                
                <Button 
                  onClick={handleGenerateExcel}
                  disabled={isGenerating}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {t('reports.downloadExcel')}
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
    </DashboardLayout>
  );
}
