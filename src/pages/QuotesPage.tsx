import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayoutWithSidebar } from '@/components/layouts/DashboardLayoutWithSidebar';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { CreateQuoteDialog } from '@/components/CreateQuoteDialog';
import { QuoteDetailsDialog } from '@/components/QuoteDetailsDialog';
import { QuoteCard } from '@/components/QuoteCard';
import { QuoteMessaging } from '@/components/QuoteMessaging';
import { useQuotes } from '@/hooks/useQuotes';
import { Quote, QuoteStatus } from '@/types/quotes';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/lib/mobileUtils';

export const QuotesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>('all');
  const [messagingQuoteId, setMessagingQuoteId] = useState<string | null>(null);
  const [messagingClientName, setMessagingClientName] = useState<string | undefined>();
  const { quotes, isLoading, archiveQuote } = useQuotes();
  const isMobile = useIsMobile();

  // Handle openMessage query parameter
  useEffect(() => {
    const openMessageParam = searchParams.get('openMessage');
    if (openMessageParam && quotes.length > 0) {
      const quote = quotes.find(q => q.id === openMessageParam);
      if (quote) {
        setMessagingQuoteId(quote.id);
        setMessagingClientName(quote.client_name || undefined);
        // Remove the query param
        searchParams.delete('openMessage');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, quotes, setSearchParams]);

  const handleViewQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    setDetailsDialogOpen(true);
  };

  const handleOpenMessaging = (quoteId: string, clientName?: string) => {
    setMessagingQuoteId(quoteId);
    setMessagingClientName(clientName);
  };

  const filterOptions = [
    { value: 'all', label: 'Tous' },
    { value: 'pending', label: 'En attente' },
    { value: 'negotiating', label: 'En négociation' },
    { value: 'accepted', label: 'Acceptés' },
    { value: 'refused', label: 'Refusés' },
    { value: 'archived', label: 'Archivés' },
  ];

  const filteredQuotes = selectedTab === 'all' 
    ? quotes 
    : quotes.filter(q => q.status === selectedTab);

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

        {/* Mobile: Select dropdown */}
        {isMobile ? (
          <div className="space-y-4">
            <Select value={selectedTab} onValueChange={(v) => setSelectedTab(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filtrer les devis" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="space-y-4">
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
            </div>
          </div>
        ) : (
          /* Desktop: Tabs */
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v)}>
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
        )}

        <CreateQuoteDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={() => {
            // Quotes will auto-refresh via React Query
          }}
        />

        <QuoteDetailsDialog 
          quote={selectedQuote}
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          onOpenMessaging={handleOpenMessaging}
        />

        {/* Quote Messaging Dialog */}
        {messagingQuoteId && (
          <QuoteMessaging
            quoteId={messagingQuoteId}
            open={!!messagingQuoteId}
            onOpenChange={(open) => {
              if (!open) {
                setMessagingQuoteId(null);
                setMessagingClientName(undefined);
              }
            }}
            clientName={messagingClientName}
          />
        )}
      </div>
    </DashboardLayoutWithSidebar>
  );
};

export default QuotesPage;