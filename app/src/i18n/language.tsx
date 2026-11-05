import { createContext, useContext, type ReactNode } from 'react';

/** Idiomas de la interfaz. Los documentos del usuario nunca se traducen. */
export type Language = 'es' | 'en';

export const LANGUAGES: readonly { value: Language; label: string }[] = [
  // Cada idioma se nombra en su propio idioma, para que siempre se reconozca.
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
];

const LanguageContext = createContext<Language>('es');

export function LanguageProvider({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): Language {
  return useContext(LanguageContext);
}
