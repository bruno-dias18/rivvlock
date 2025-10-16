import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayoutWithSidebar } from '@/components/layouts/DashboardLayoutWithSidebar';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Send, Inbox } from 'lucide-react';
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
  const [selectedTab, setSelectedTab] = useState<string>('sent');
  const [messagingQuoteId, setMessagingQuoteId] = useState<string | null>(null);
  const [messagingClientName, setMessagingClientName] = useState<string | undefined>();
  const { sentQuotes, receivedQuotes, isLoading, archiveQuote } = useQuotes();
  const isMobile = useIsMobile();

  // Handle openMessage query parameter
  useEffect(() => {
    const openMessageParam = searchParams.get('openMessage');
    const allQuotes = [...sentQuotes, ...receivedQuotes];
    if (openMessageParam && allQuotes.length > 0) {
      const quote = allQuotes.find(q => q.id === openMessageParam);
      if (quote) {
        setMessagingQuoteId(quote.id);
        setMessagingClientName(quote.client_name || undefined);
        // Remove the query param
        searchParams.delete('openMessage');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, sentQuotes, receivedQuotes, setSearchParams]);

  const handleViewQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    setDetailsDialogOpen(true);
  };

  const handleOpenMessaging = (quoteId: string, clientName?: string) => {
    setMessagingQuoteId(quoteId);
    setMessagingClientName(clientName);
  };

  const currentQuotes = selectedTab === 'sent' ? sentQuotes : receivedQuotes;

  return (
    <DashboardLayoutWithSidebar>
      <div className={isMobile ? "space-y-4 pb-20" : "space-y-6"}>
        <div className={`flex justify-between items-center ${isMobile ? 'gap-2' : ''}`}>
          <h1 className={isMobile ? "text-2xl font-bold" : "text-3xl font-bold"}>Mes Devis</h1>
          <Button onClick={() => setCreateDialogOpen(true)} size={isMobile ? "sm" : "default"}>
            <Plus className="h-4 w-4 mr-2" />
            {isMobile ? "Créer" : "Créer un devis"}
          </Button>
        </div>

        {/* Tabs for Sent / Received */}
        <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sent" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Envoyés ({sentQuotes.length})
            </TabsTrigger>
            <TabsTrigger value="received" className="flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              Reçus ({receivedQuotes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sent" className="space-y-4 mt-6">
            {isLoading ? (
              <div className="text-center py-4">Chargement...</div>
            ) : sentQuotes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucun devis envoyé</p>
              </div>
            ) : (
              sentQuotes.map(quote => (
                <QuoteCard
                  key={quote.id}
                  quote={quote}
                  onView={() => handleViewQuote(quote)}
                  onArchive={() => archiveQuote(quote.id)}
                  onOpenMessaging={() => handleOpenMessaging(quote.id, quote.client_name || undefined)}
                  isSeller={true}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="received" className="space-y-4 mt-6">
            {isLoading ? (
              <div className="text-center py-4">Chargement...</div>
            ) : receivedQuotes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucun devis reçu</p>
                <p className="text-sm mt-2">
                  Les devis que vous acceptez ou sur lesquels vous posez des questions apparaîtront ici
                </p>
              </div>
            ) : (
              receivedQuotes.map(quote => (
                <QuoteCard
                  key={quote.id}
                  quote={quote}
                  onView={() => handleViewQuote(quote)}
                  onArchive={() => archiveQuote(quote.id)}
                  onOpenMessaging={() => handleOpenMessaging(quote.id, quote.client_name || undefined)}
                  isSeller={false}
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