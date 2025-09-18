import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export type Currency = 'EUR' | 'CHF';

interface CurrencyInfo {
  code: Currency;
  symbol: string;
  name: string;
}

const currencyMap: Record<Currency, CurrencyInfo> = {
  EUR: { code: 'EUR', symbol: '€', name: 'Euro' },
  CHF: { code: 'CHF', symbol: 'CHF', name: 'Franc Suisse' }
};

export const useCurrency = () => {
  const { i18n } = useTranslation();
  const [currency, setCurrency] = useState<Currency>(() => {
    const saved = localStorage.getItem('rivvlock-currency');
    return (saved as Currency) || 'EUR';
  });

  useEffect(() => {
    localStorage.setItem('rivvlock-currency', currency);
  }, [currency]);

  // Auto-detect currency based on country/language
  const detectCurrency = (): Currency => {
    const lang = i18n.language;
    if (lang.includes('de') || lang.includes('ch')) {
      return 'CHF';
    }
    return 'EUR';
  };

  const formatAmount = (amount: number, currencyCode?: Currency): string => {
    const curr = currencyCode || currency;
    const info = currencyMap[curr];
    
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: curr,
    }).format(amount);
  };

  const switchCurrency = (newCurrency: Currency) => {
    setCurrency(newCurrency);
  };

  return {
    currency,
    currencyInfo: currencyMap[currency],
    currencies: Object.values(currencyMap),
    formatAmount,
    switchCurrency,
    detectCurrency,
  };
};