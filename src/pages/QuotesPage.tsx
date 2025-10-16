import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardLayoutWithSidebar } from '@/components/layouts/DashboardLayoutWithSidebar';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useQuotes } from '@/hooks/useQuotes';
import { CreateQuoteDialog } from '@/components/CreateQuoteDialog';
import { QuoteCard } from '@/components/QuoteCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Quote, QuoteStatus } from '@/types/quotes';

const QuotesPage = () => {
  const { quotes, isLoading, archiveQuote } = useQuotes();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<QuoteStatus | 'all'>('all');

  const filteredQuotes = selectedTab === 'all' 
    ? quotes 
    : quotes.filter(q => q.status === selectedTab);

  const handleViewQuote = (quote: Quote) => {
    // TODO: Ouvrir dialog de détails
    console.log('View quote:', quote);
  };

  return (
    <DashboardLayoutWithSidebar>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Mes Devis</h1>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Créer un devis
          </Button>
        </div>

        <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as QuoteStatus | 'all')}>
          <TabsList>
            <TabsTrigger value="all">Tous</TabsTrigger>
            <TabsTrigger value="pending">En attente</TabsTrigger>
            <TabsTrigger value="negotiating">En négociation</TabsTrigger>
            <TabsTrigger value="accepted">Acceptés</TabsTrigger>
            <TabsTrigger value="refused">Refusés</TabsTrigger>
            <TabsTrigger value="archived">Archivés</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="space-y-4">
            {isLoading ? (
              <p>Chargement...</p>
            ) : filteredQuotes.length === 0 ? (
              <p className="text-muted-foreground">Aucun devis dans cette catégorie</p>
            ) : (
              filteredQuotes.map(quote => (
                <QuoteCard
                  key={quote.id}
                  quote={quote}
                  onView={handleViewQuote}
                  onArchive={archiveQuote}
                />
              ))
            )}
          </TabsContent>
        </Tabs>

        <CreateQuoteDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={() => {
            // Quotes will auto-refresh via React Query
          }}
        />
      </div>
    </DashboardLayoutWithSidebar>
  );
};

export default QuotesPage;
