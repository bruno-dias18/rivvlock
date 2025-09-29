import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

const TermsOfServicePage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header with back link */}
        <div className="mb-8">
          <Link 
            to="/auth" 
            className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back')}
          </Link>
          
          <h1 className="text-3xl font-bold text-primary mb-2">
            {t('terms.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('terms.lastUpdated')}: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Table of Contents */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('terms.tableOfContents')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a href="#introduction" className="block text-primary hover:underline">1. {t('terms.sections.introduction')}</a>
            <a href="#service-description" className="block text-primary hover:underline">2. {t('terms.sections.serviceDescription')}</a>
            <a href="#service-conditions" className="block text-primary hover:underline">3. {t('terms.sections.serviceConditions')}</a>
            <a href="#fees-pricing" className="block text-primary hover:underline">4. {t('terms.sections.feesPricing')}</a>
            <a href="#disputes-refunds" className="block text-primary hover:underline">5. {t('terms.sections.disputesRefunds')}</a>
            <a href="#user-responsibilities" className="block text-primary hover:underline">6. {t('terms.sections.userResponsibilities')}</a>
            <a href="#data-protection" className="block text-primary hover:underline">7. {t('terms.sections.dataProtection')}</a>
            <a href="#intellectual-property" className="block text-primary hover:underline">8. {t('terms.sections.intellectualProperty')}</a>
            <a href="#liability-limitation" className="block text-primary hover:underline">9. {t('terms.sections.liabilityLimitation')}</a>
            <a href="#service-termination" className="block text-primary hover:underline">10. {t('terms.sections.serviceTermination')}</a>
            <a href="#applicable-law" className="block text-primary hover:underline">11. {t('terms.sections.applicableLaw')}</a>
            <a href="#contact-support" className="block text-primary hover:underline">12. {t('terms.sections.contactSupport')}</a>
          </CardContent>
        </Card>

        {/* Terms Content */}
        <div className="space-y-8">
          {/* Section 1: Introduction */}
          <Card id="introduction">
            <CardHeader>
              <CardTitle>1. {t('terms.sections.introduction')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>{t('terms.content.introduction.welcome')}</p>
              <p>{t('terms.content.introduction.acceptance')}</p>
            </CardContent>
          </Card>

          {/* Section 2: Service Description */}
          <Card id="service-description">
            <CardHeader>
              <CardTitle>2. {t('terms.sections.serviceDescription')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>{t('terms.content.serviceDescription.main')}</p>
              <ul>
                <li>{t('terms.content.serviceDescription.escrow')}</li>
                <li>{t('terms.content.serviceDescription.payments')}</li>
                <li>{t('terms.content.serviceDescription.security')}</li>
                <li>{t('terms.content.serviceDescription.mediation')}</li>
              </ul>
            </CardContent>
          </Card>

          {/* Section 3: Service Conditions */}
          <Card id="service-conditions">
            <CardHeader>
              <CardTitle>3. {t('terms.sections.serviceConditions')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>{t('terms.content.serviceConditions.eligibility')}</p>
              <p>{t('terms.content.serviceConditions.account')}</p>
              <p>{t('terms.content.serviceConditions.verification')}</p>
            </CardContent>
          </Card>

          {/* Section 4: Fees and Pricing */}
          <Card id="fees-pricing">
            <CardHeader>
              <CardTitle>4. {t('terms.sections.feesPricing')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>{t('terms.content.feesPricing.commission')}</p>
              <p>{t('terms.content.feesPricing.payment')}</p>
              <p>{t('terms.content.feesPricing.included')}</p>
            </CardContent>
          </Card>

          {/* Section 5: Disputes and Refunds */}
          <Card id="disputes-refunds">
            <CardHeader>
              <CardTitle>5. {t('terms.sections.disputesRefunds')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>{t('terms.content.disputesRefunds.policy')}</p>
              <p>{t('terms.content.disputesRefunds.customerWins')}</p>
              <p>{t('terms.content.disputesRefunds.sellerWins')}</p>
              <p className="font-semibold text-amber-700 dark:text-amber-400">{t('terms.content.disputesRefunds.stripeFeesNote')}</p>
              <p>{t('terms.content.disputesRefunds.mediation')}</p>
            </CardContent>
          </Card>

          {/* Section 6: User Responsibilities */}
          <Card id="user-responsibilities">
            <CardHeader>
              <CardTitle>6. {t('terms.sections.userResponsibilities')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <ul>
                <li>{t('terms.content.userResponsibilities.accurate')}</li>
                <li>{t('terms.content.userResponsibilities.security')}</li>
                <li>{t('terms.content.userResponsibilities.compliance')}</li>
                <li>{t('terms.content.userResponsibilities.prohibited')}</li>
              </ul>
            </CardContent>
          </Card>

          {/* Section 7: Data Protection */}
          <Card id="data-protection">
            <CardHeader>
              <CardTitle>7. {t('terms.sections.dataProtection')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>{t('terms.content.dataProtection.gdpr')}</p>
              <p>{t('terms.content.dataProtection.collection')}</p>
              <p>{t('terms.content.dataProtection.rights')}</p>
            </CardContent>
          </Card>

          {/* Section 8: Intellectual Property */}
          <Card id="intellectual-property">
            <CardHeader>
              <CardTitle>8. {t('terms.sections.intellectualProperty')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>{t('terms.content.intellectualProperty.ownership')}</p>
              <p>{t('terms.content.intellectualProperty.license')}</p>
            </CardContent>
          </Card>

          {/* Section 9: Liability Limitation */}
          <Card id="liability-limitation">
            <CardHeader>
              <CardTitle>9. {t('terms.sections.liabilityLimitation')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>{t('terms.content.liabilityLimitation.intermediary')}</p>
              <p>{t('terms.content.liabilityLimitation.limitation')}</p>
              <p>{t('terms.content.liabilityLimitation.disputes')}</p>
            </CardContent>
          </Card>

          {/* Section 10: Service Termination */}
          <Card id="service-termination">
            <CardHeader>
              <CardTitle>10. {t('terms.sections.serviceTermination')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>{t('terms.content.serviceTermination.userRight')}</p>
              <p>{t('terms.content.serviceTermination.platformRight')}</p>
              <p>{t('terms.content.serviceTermination.consequences')}</p>
            </CardContent>
          </Card>

          {/* Section 11: Applicable Law */}
          <Card id="applicable-law">
            <CardHeader>
              <CardTitle>11. {t('terms.sections.applicableLaw')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>{t('terms.content.applicableLaw.governing')}</p>
              <p>{t('terms.content.applicableLaw.jurisdiction')}</p>
            </CardContent>
          </Card>

          {/* Section 12: Contact and Support */}
          <Card id="contact-support">
            <CardHeader>
              <CardTitle>12. {t('terms.sections.contactSupport')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>{t('terms.content.contactSupport.questions')}</p>
              <p>
                <strong>Email:</strong> support@rivvlock.com<br />
                <strong>Website:</strong> <a href="https://rivvlock.com" className="text-primary hover:underline">rivvlock.com</a>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <Link 
            to="/auth" 
            className="inline-flex items-center text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('terms.backToRegistration')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;