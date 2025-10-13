import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Shield } from 'lucide-react';

const PrivacyPolicyPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const langParam = searchParams.get('lang');
    if (langParam && langParam !== i18n.language) {
      i18n.changeLanguage(langParam);
    }
  }, [searchParams, i18n]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link 
            to="/auth" 
            className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back')}
          </Link>
          
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-primary">
              {t('privacy.title')}
            </h1>
          </div>
          <p className="text-muted-foreground">
            {t('privacy.lastUpdated')}: {new Date().toLocaleDateString()}
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('privacy.tableOfContents')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a href="#data-controller" className="block text-primary hover:underline">1. {t('privacy.sections.dataController')}</a>
            <a href="#data-collected" className="block text-primary hover:underline">2. {t('privacy.sections.dataCollected')}</a>
            <a href="#purpose" className="block text-primary hover:underline">3. {t('privacy.sections.purpose')}</a>
            <a href="#legal-basis" className="block text-primary hover:underline">4. {t('privacy.sections.legalBasis')}</a>
            <a href="#retention" className="block text-primary hover:underline">5. {t('privacy.sections.retention')}</a>
            <a href="#security" className="block text-primary hover:underline">6. {t('privacy.sections.security')}</a>
            <a href="#your-rights" className="block text-primary hover:underline">7. {t('privacy.sections.yourRights')}</a>
            <a href="#data-sharing" className="block text-primary hover:underline">8. {t('privacy.sections.dataSharing')}</a>
            <a href="#cookies" className="block text-primary hover:underline">9. {t('privacy.sections.cookies')}</a>
            <a href="#international" className="block text-primary hover:underline">10. {t('privacy.sections.international')}</a>
            <a href="#changes" className="block text-primary hover:underline">11. {t('privacy.sections.changes')}</a>
            <a href="#contact" className="block text-primary hover:underline">12. {t('privacy.sections.contact')}</a>
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card id="data-controller">
            <CardHeader>
              <CardTitle>1. {t('privacy.sections.dataController')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>{t('privacy.content.dataController.intro')}</p>
              <p>
                <strong>RivvLock</strong><br />
                Email: privacy@rivvlock.com<br />
                Website: <a href="https://rivvlock.com" className="text-primary hover:underline">rivvlock.com</a>
              </p>
            </CardContent>
          </Card>

          <Card id="data-collected">
            <CardHeader>
              <CardTitle>2. {t('privacy.sections.dataCollected')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>{t('privacy.content.dataCollected.intro')}</p>
              
              <h4 className="font-semibold mt-4">{t('privacy.content.dataCollected.identity.title')}</h4>
              <ul>
                <li>{t('privacy.content.dataCollected.identity.name')}</li>
                <li>{t('privacy.content.dataCollected.identity.email')}</li>
                <li>{t('privacy.content.dataCollected.identity.phone')}</li>
                <li>{t('privacy.content.dataCollected.identity.address')}</li>
              </ul>

              <h4 className="font-semibold mt-4">{t('privacy.content.dataCollected.professional.title')}</h4>
              <ul>
                <li>{t('privacy.content.dataCollected.professional.company')}</li>
                <li>{t('privacy.content.dataCollected.professional.siret')}</li>
                <li>{t('privacy.content.dataCollected.professional.vat')}</li>
                <li>{t('privacy.content.dataCollected.professional.avs')}</li>
              </ul>

              <h4 className="font-semibold mt-4">{t('privacy.content.dataCollected.financial.title')}</h4>
              <ul>
                <li>{t('privacy.content.dataCollected.financial.stripe')}</li>
                <li>{t('privacy.content.dataCollected.financial.transactions')}</li>
              </ul>

              <h4 className="font-semibold mt-4">{t('privacy.content.dataCollected.technical.title')}</h4>
              <ul>
                <li>{t('privacy.content.dataCollected.technical.ip')}</li>
                <li>{t('privacy.content.dataCollected.technical.logs')}</li>
              </ul>
            </CardContent>
          </Card>

          <Card id="purpose">
            <CardHeader>
              <CardTitle>3. {t('privacy.sections.purpose')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <ul>
                <li>{t('privacy.content.purpose.service')}</li>
                <li>{t('privacy.content.purpose.payment')}</li>
                <li>{t('privacy.content.purpose.compliance')}</li>
                <li>{t('privacy.content.purpose.security')}</li>
                <li>{t('privacy.content.purpose.support')}</li>
                <li>{t('privacy.content.purpose.improvement')}</li>
              </ul>
            </CardContent>
          </Card>

          <Card id="legal-basis">
            <CardHeader>
              <CardTitle>4. {t('privacy.sections.legalBasis')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <ul>
                <li><strong>{t('privacy.content.legalBasis.contract.title')}</strong>: {t('privacy.content.legalBasis.contract.desc')}</li>
                <li><strong>{t('privacy.content.legalBasis.legal.title')}</strong>: {t('privacy.content.legalBasis.legal.desc')}</li>
                <li><strong>{t('privacy.content.legalBasis.consent.title')}</strong>: {t('privacy.content.legalBasis.consent.desc')}</li>
                <li><strong>{t('privacy.content.legalBasis.legitimate.title')}</strong>: {t('privacy.content.legalBasis.legitimate.desc')}</li>
              </ul>
            </CardContent>
          </Card>

          <Card id="retention">
            <CardHeader>
              <CardTitle>5. {t('privacy.sections.retention')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <ul>
                <li><strong>{t('privacy.content.retention.account.title')}</strong>: {t('privacy.content.retention.account.duration')}</li>
                <li><strong>{t('privacy.content.retention.transactions.title')}</strong>: {t('privacy.content.retention.transactions.duration')}</li>
                <li><strong>{t('privacy.content.retention.invoices.title')}</strong>: {t('privacy.content.retention.invoices.duration')}</li>
                <li><strong>{t('privacy.content.retention.logs.title')}</strong>: {t('privacy.content.retention.logs.duration')}</li>
              </ul>
              <p className="mt-4">{t('privacy.content.retention.note')}</p>
            </CardContent>
          </Card>

          <Card id="security">
            <CardHeader>
              <CardTitle>6. {t('privacy.sections.security')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>{t('privacy.content.security.intro')}</p>
              <ul>
                <li>{t('privacy.content.security.encryption')}</li>
                <li>{t('privacy.content.security.rls')}</li>
                <li>{t('privacy.content.security.audit')}</li>
                <li>{t('privacy.content.security.access')}</li>
                <li>{t('privacy.content.security.stripe')}</li>
              </ul>
            </CardContent>
          </Card>

          <Card id="your-rights">
            <CardHeader>
              <CardTitle>7. {t('privacy.sections.yourRights')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>{t('privacy.content.yourRights.intro')}</p>
              <ul>
                <li><strong>{t('privacy.content.yourRights.access.title')}</strong>: {t('privacy.content.yourRights.access.desc')}</li>
                <li><strong>{t('privacy.content.yourRights.rectification.title')}</strong>: {t('privacy.content.yourRights.rectification.desc')}</li>
                <li><strong>{t('privacy.content.yourRights.erasure.title')}</strong>: {t('privacy.content.yourRights.erasure.desc')}</li>
                <li><strong>{t('privacy.content.yourRights.portability.title')}</strong>: {t('privacy.content.yourRights.portability.desc')}</li>
                <li><strong>{t('privacy.content.yourRights.restriction.title')}</strong>: {t('privacy.content.yourRights.restriction.desc')}</li>
                <li><strong>{t('privacy.content.yourRights.objection.title')}</strong>: {t('privacy.content.yourRights.objection.desc')}</li>
              </ul>
              <p className="mt-4">{t('privacy.content.yourRights.exercise')}</p>
            </CardContent>
          </Card>

          <Card id="data-sharing">
            <CardHeader>
              <CardTitle>8. {t('privacy.sections.dataSharing')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <ul>
                <li><strong>Stripe</strong>: {t('privacy.content.dataSharing.stripe')}</li>
                <li><strong>Supabase</strong>: {t('privacy.content.dataSharing.supabase')}</li>
                <li><strong>{t('privacy.content.dataSharing.legal.title')}</strong>: {t('privacy.content.dataSharing.legal.desc')}</li>
              </ul>
              <p className="mt-4">{t('privacy.content.dataSharing.noSale')}</p>
            </CardContent>
          </Card>

          <Card id="cookies">
            <CardHeader>
              <CardTitle>9. {t('privacy.sections.cookies')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>{t('privacy.content.cookies.essential')}</p>
              <ul>
                <li>{t('privacy.content.cookies.auth')}</li>
                <li>{t('privacy.content.cookies.language')}</li>
              </ul>
              <p className="mt-4">{t('privacy.content.cookies.noTracking')}</p>
            </CardContent>
          </Card>

          <Card id="international">
            <CardHeader>
              <CardTitle>10. {t('privacy.sections.international')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>{t('privacy.content.international.hosting')}</p>
              <p>{t('privacy.content.international.adequacy')}</p>
            </CardContent>
          </Card>

          <Card id="changes">
            <CardHeader>
              <CardTitle>11. {t('privacy.sections.changes')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>{t('privacy.content.changes.update')}</p>
              <p>{t('privacy.content.changes.notification')}</p>
            </CardContent>
          </Card>

          <Card id="contact">
            <CardHeader>
              <CardTitle>12. {t('privacy.sections.contact')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>{t('privacy.content.contact.intro')}</p>
              <p>
                <strong>Email</strong>: privacy@rivvlock.com<br />
                <strong>Website</strong>: <a href="https://rivvlock.com" className="text-primary hover:underline">rivvlock.com</a>
              </p>
              <p className="mt-4">{t('privacy.content.contact.authority')}</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <Link 
            to="/auth" 
            className="inline-flex items-center text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('privacy.backToRegistration')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
