import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Download, BarChart3, Globe, TrendingUp } from 'lucide-react';
import { generateCompetitorAnalysisPDF } from '@/lib/competitorPdfGenerator';
import { toast } from 'sonner';

const CompetitorAnalysisPage = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownloadPDF = async () => {
    try {
      setIsGenerating(true);
      await generateCompetitorAnalysisPDF();
      toast.success('PDF téléchargé avec succès !');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Analyse Concurrentielle RivvLock
          </h1>
          <p className="text-muted-foreground text-lg">
            Étude comparative complète des acteurs du marché escrow en Suisse, France et Allemagne
          </p>
        </div>

        <Card className="mb-8 border-2 border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Rapport PDF Complet
            </CardTitle>
            <CardDescription>
              Téléchargez l'analyse détaillée de 15+ concurrents avec tableaux comparatifs, 
              positionnement stratégique et recommandations pour Fongit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleDownloadPDF}
              disabled={isGenerating}
              size="lg"
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin mr-2 h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-5 w-5" />
                  Télécharger le PDF d'analyse
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="h-5 w-5 text-primary" />
                3 Marchés
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Suisse, France et Allemagne analysés en profondeur
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
                15+ Concurrents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Comparaison détaillée de tous les acteurs majeurs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
                Positionnement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Forces, différenciateurs et recommandations stratégiques
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-secondary/20">
          <CardHeader>
            <CardTitle className="text-lg">Contenu du PDF (4 pages)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">📊</span>
                <span>
                  <strong>Page 1 :</strong> Vue d'ensemble du marché avec statistiques clés et positionnement RivvLock
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">📋</span>
                <span>
                  <strong>Page 2 :</strong> Tableau comparatif détaillé (frais, setup, régulation, services)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">💪</span>
                <span>
                  <strong>Page 3 :</strong> Forces et différenciateurs de RivvLock face à la concurrence
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">🎯</span>
                <span>
                  <strong>Page 4 :</strong> Recommandations stratégiques et arguments commerciaux par concurrent
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Document préparé pour la présentation Fongit • Octobre 2025
          </p>
        </div>
      </div>
    </div>
  );
};

export default CompetitorAnalysisPage;
