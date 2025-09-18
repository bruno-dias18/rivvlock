import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/hooks/useLanguage';
import { useCurrency } from '@/hooks/useCurrency';
import { Globe, DollarSign } from 'lucide-react';

export const LanguageCurrencySwitch = () => {
  const { currentLanguage: language, languages, switchLanguage } = useLanguage();
  const { currency, currencies, switchCurrency } = useCurrency();

  return (
    <div className="flex items-center gap-3">
      {/* Language Selector */}
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-muted-foreground" />
        <Select value={language} onValueChange={(value) => switchLanguage(value as 'fr' | 'en' | 'de')}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languages.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                <div className="flex items-center gap-2">
                  <span>{lang.flag}</span>
                  <span className="text-xs">{lang.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Currency Selector */}
      <div className="flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-muted-foreground" />
        <Select value={currency} onValueChange={(value) => switchCurrency(value as 'EUR' | 'CHF')}>
          <SelectTrigger className="w-[80px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currencies.map((curr) => (
              <SelectItem key={curr.code} value={curr.code}>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium">{curr.code}</span>
                  <span className="text-xs text-muted-foreground">{curr.symbol}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};