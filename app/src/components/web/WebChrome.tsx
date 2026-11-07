import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useLanguage } from '@/i18n/language';
import { useTheme } from '@/theme';

const STYLE_ID = 'apuntor-web-chrome';

/**
 * Ajustes solo para web que React Native no cubre:
 * - `color-scheme` del documento según el tema, para que las barras de desplazamiento y los
 *   controles nativos del navegador no queden oscuros en modo claro (ni al revés);
 * - barras de desplazamiento finas con los colores del tema;
 * - sin el contorno de foco del navegador en los campos de texto (el foco se marca con el
 *   borde del propio campo). Los botones llevan un anillo de foco de teclado con el color de marca;
 * - selección de texto y cursor con los colores del tema.
 */
export function WebChrome() {
  const { mode, c } = useTheme();
  const language = useLanguage();
  useEffect(() => {
    // Para lectores de pantalla y la traducción automática del navegador.
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.style.colorScheme = mode;
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = `
      * { scrollbar-width: thin; scrollbar-color: ${c.border} transparent; }
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: ${c.border}; border-radius: 999px; border: 2px solid ${c.bg}; }
      ::-webkit-scrollbar-thumb:hover { background: ${c.textMuted}; }
      input, textarea { outline: none !important; caret-color: ${c.primary}; }
      ::selection { background: ${c.primarySoft}; color: ${c.text}; }
      [role='button']:focus-visible, [role='link']:focus-visible, [role='tab']:focus-visible,
      [role='switch']:focus-visible, [role='checkbox']:focus-visible, [role='radio']:focus-visible,
      a:focus-visible, button:focus-visible {
        outline: 2px solid ${c.primary};
        outline-offset: 2px;
      }
    `;
  }, [mode, c]);
  return null;
}
