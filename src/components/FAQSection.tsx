import { useTranslation } from 'react-i18next';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState, useMemo, memo } from 'react';

interface FAQItemProps {
  question: string;
  answer: string;
}

const FAQItem = memo(({ question, answer }: FAQItemProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b border-border pb-4 last:border-0">
      <CollapsibleTrigger className="flex w-full items-center justify-between text-left hover:text-primary transition-colors py-3">
        <span className="font-medium text-foreground pr-4">{question}</span>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'transform rotate-180' : ''
          }`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pb-3">
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {answer}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
});

FAQItem.displayName = 'FAQItem';

/**
 * FAQ Section Component
 * Displays frequently asked questions in an optimized accordion format
 * Uses memoization to prevent unnecessary re-renders
 */
export function FAQSection() {
  const { t } = useTranslation();

  // Memoize FAQ data to prevent recreation on every render
  const faqs = useMemo(() => [
    {
      id: 'whatIsRivvlock',
      question: t('faq.whatIsRivvlock.question'),
      answer: t('faq.whatIsRivvlock.answer')
    },
    {
      id: 'howItWorks',
      question: t('faq.howItWorks.question'),
      answer: t('faq.howItWorks.answer')
    },
    {
      id: 'whoCanUse',
      question: t('faq.whoCanUse.question'),
      answer: t('faq.whoCanUse.answer')
    },
    {
      id: 'fees',
      question: t('faq.fees.question'),
      answer: t('faq.fees.answer')
    },
    {
      id: 'stripeAccount',
      question: t('faq.stripeAccount.question'),
      answer: t('faq.stripeAccount.answer')
    },
    {
      id: 'paymentMethods',
      question: t('faq.paymentMethods.question'),
      answer: t('faq.paymentMethods.answer')
    },
    {
      id: 'fundsRelease',
      question: t('faq.fundsRelease.question'),
      answer: t('faq.fundsRelease.answer')
    },
    {
      id: 'paymentSecurity',
      question: t('faq.paymentSecurity.question'),
      answer: t('faq.paymentSecurity.answer')
    },
    {
      id: 'dispute',
      question: t('faq.dispute.question'),
      answer: t('faq.dispute.answer')
    },
    {
      id: 'disputeResolution',
      question: t('faq.disputeResolution.question'),
      answer: t('faq.disputeResolution.answer')
    },
    {
      id: 'paymentCancellation',
      question: t('faq.paymentCancellation.question'),
      answer: t('faq.paymentCancellation.answer')
    },
    {
      id: 'invoices',
      question: t('faq.invoices.question'),
      answer: t('faq.invoices.answer')
    },
    {
      id: 'availability',
      question: t('faq.availability.question'),
      answer: t('faq.availability.answer')
    },
    {
      id: 'forBusiness',
      question: t('faq.forBusiness.question'),
      answer: t('faq.forBusiness.answer')
    },
    {
      id: 'customerSupport',
      question: t('faq.customerSupport.question'),
      answer: t('faq.customerSupport.answer')
    }
  ], [t]);

  return (
    <div className="space-y-2">
      {faqs.map((faq) => (
        <FAQItem key={faq.id} question={faq.question} answer={faq.answer} />
      ))}
    </div>
  );
}
