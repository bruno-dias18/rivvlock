import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Separator } from '@/components/ui/separator';
import { ExternalLink } from 'lucide-react';

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-background border-t">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center space-x-6 text-sm">
            <Link
              to="/terms"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('footer.terms')}
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <Link
              to="/privacy"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('footer.privacy')}
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <Link
              to="/contact"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('footer.contact')}
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <Link
              to="/api-docs"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              API Docs
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <a
              href="https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/health"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              Status
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {t('footer.copyright')}
          </p>
        </div>
      </div>
    </footer>
  );
}