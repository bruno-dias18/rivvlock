import { useEffect, useState } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/lib/logger';

const ApiDocsPage = () => {
  const navigate = useNavigate();
  const [spec, setSpec] = useState<any>(null);

  useEffect(() => {
    // Load OpenAPI spec
    fetch('/openapi.yaml')
      .then((res) => res.text())
      .then((yamlText) => {
        // Parse YAML (simple approach, swagger-ui handles it)
        setSpec(yamlText);
      })
      .catch((err) => {
        logger.error('Failed to load OpenAPI spec:', err);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour
              </Button>
              <div>
                <h1 className="text-2xl font-bold">API Documentation Interactive</h1>
                <p className="text-sm text-muted-foreground">
                  Testez directement l'API RivvLock dans votre navigateur
                </p>
              </div>
            </div>
            <a
              href="https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/health"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Status Page</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Swagger UI */}
      <div className="container mx-auto px-4 py-6">
        {spec ? (
          <SwaggerUI
            spec={spec}
            docExpansion="list"
            defaultModelsExpandDepth={1}
            tryItOutEnabled={true}
          />
        ) : (
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">Chargement de la documentation...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiDocsPage;
