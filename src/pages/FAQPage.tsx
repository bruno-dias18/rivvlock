import { useTranslation } from 'react-i18next';
import { DashboardLayoutWithSidebar } from '@/components/layouts/DashboardLayoutWithSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FAQSection } from '@/components/FAQSection';
import { HelpCircle } from 'lucide-react';

export default function FAQPage() {
  const { t } = useTranslation();

  return (
    <DashboardLayoutWithSidebar>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <HelpCircle className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('faq.title')}</h1>
            <p className="text-muted-foreground">{t('faq.subtitle')}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('faq.title')}</CardTitle>
            <CardDescription>{t('faq.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <FAQSection />
          </CardContent>
        </Card>
      </div>
    </DashboardLayoutWithSidebar>
  );
}
