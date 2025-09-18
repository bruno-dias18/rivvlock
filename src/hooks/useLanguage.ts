import { useTranslation } from 'react-i18next';

export type Language = 'fr' | 'en' | 'de';

interface LanguageInfo {
  code: Language;
  name: string;
  flag: string;
}

const languageMap: Record<Language, LanguageInfo> = {
  fr: { code: 'fr', name: 'Français', flag: '🇫🇷' },
  en: { code: 'en', name: 'English', flag: '🇬🇧' },
  de: { code: 'de', name: 'Deutsch', flag: '🇩🇪' }
};

export const useLanguage = () => {
  const { i18n } = useTranslation();

  const currentLanguage = i18n.language as Language;

  const switchLanguage = (lang: Language) => {
    i18n.changeLanguage(lang);
  };

  const languages = Object.values(languageMap);

  return {
    currentLanguage,
    currentLanguageInfo: languageMap[currentLanguage] || languageMap.fr,
    languages,
    switchLanguage,
  };
};