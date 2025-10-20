import { useTranslation } from 'react-i18next';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface FAQItemProps {
  question: string;
  answer: string;
}

function FAQItem({ question, answer }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b border-border pb-4">
      <CollapsibleTrigger className="flex w-full items-center justify-between text-left hover:text-primary transition-colors">
        <span className="font-medium text-foreground pr-4">{question}</span>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'transform rotate-180' : ''
          }`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {answer}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function FAQSection() {
  const { t } = useTranslation();

  const faqs = [
    {
      question: t('faq.whatIsRivvlock.question'),
      answer: t('faq.whatIsRivvlock.answer')
    },
    {
      question: t('faq.howItWorks.question'),
      answer: t('faq.howItWorks.answer')
    },
    {
      question: t('faq.whoCanUse.question'),
      answer: t('faq.whoCanUse.answer')
    },
    {
      question: t('faq.fees.question'),
      answer: t('faq.fees.answer')
    },
    {
      question: t('faq.stripeAccount.question'),
      answer: t('faq.stripeAccount.answer')
    },
    {
      question: t('faq.paymentMethods.question'),
      answer: t('faq.paymentMethods.answer')
    },
    {
      question: t('faq.fundsRelease.question'),
      answer: t('faq.fundsRelease.answer')
    },
    {
      question: t('faq.paymentSecurity.question'),
      answer: t('faq.paymentSecurity.answer')
    },
    {
      question: t('faq.dispute.question'),
      answer: t('faq.dispute.answer')
    },
    {
      question: t('faq.disputeResolution.question'),
      answer: t('faq.disputeResolution.answer')
    },
    {
      question: t('faq.paymentCancellation.question'),
      answer: t('faq.paymentCancellation.answer')
    },
    {
      question: t('faq.invoices.question'),
      answer: t('faq.invoices.answer')
    },
    {
      question: t('faq.availability.question'),
      answer: t('faq.availability.answer')
    },
    {
      question: t('faq.forBusiness.question'),
      answer: t('faq.forBusiness.answer')
    },
    {
      question: t('faq.customerSupport.question'),
      answer: t('faq.customerSupport.answer')
    }
  ];

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">{t('faq.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('faq.subtitle')}</p>
      </div>
      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <FAQItem key={index} question={faq.question} answer={faq.answer} />
        ))}
      </div>
    </div>
  );
}
