/** Las 52 pantallas diseñadas (mapa §2 + estados 45–52), más las agregadas en revisión (53+). */
export interface ScreenEntry {
  n: number;
  name: string;
  href: string;
  /** true = construida a partir de un diseño; false = propuesta sin diseño todavía. */
  designed: boolean;
}

export const screenGroups: { title: string; screens: ScreenEntry[] }[] = [
  {
    title: 'Acceso y registro',
    screens: [
      { n: 1, name: 'Inicio de sesión', href: '/login', designed: true },
      { n: 11, name: 'Registro', href: '/register', designed: true },
      { n: 12, name: 'Recuperar contraseña', href: '/forgot-password', designed: true },
      { n: 13, name: 'Enlace enviado', href: '/link-sent', designed: true },
      { n: 15, name: 'Privacidad y consentimiento', href: '/privacy', designed: true },
      { n: 14, name: 'Onboarding', href: '/onboarding', designed: true },
      {
        n: 33,
        name: 'Permiso de notificaciones',
        href: '/notifications-permission',
        designed: true,
      },
      { n: 44, name: 'Lista de espera', href: '/waitlist', designed: true },
    ],
  },
  {
    title: 'Subir y organizar documentos',
    screens: [
      { n: 2, name: 'Subir documentos', href: '/upload', designed: true },
      { n: 17, name: 'Subiendo', href: '/upload/progress', designed: true },
      { n: 18, name: 'Subida con problemas', href: '/upload/problems', designed: true },
      { n: 16, name: 'Revisar clasificación', href: '/upload/review', designed: true },
      { n: 9, name: 'Error al procesar archivos', href: '/upload/errors', designed: true },
      { n: 41, name: 'Idioma no compatible', href: '/upload/language', designed: true },
      { n: 28, name: 'Escanear apunte', href: '/upload/scan', designed: true },
      { n: 29, name: 'Lectura poco clara', href: '/upload/scan-review', designed: true },
    ],
  },
  {
    title: 'Navegación principal',
    screens: [
      { n: 6, name: 'Inicio', href: '/home', designed: true },
      { n: 3, name: 'Cursos y temas', href: '/courses', designed: true },
      { n: 8, name: 'Cursos vacío', href: '/courses?demo=empty', designed: true },
      { n: 20, name: 'Detalle de curso', href: '/courses/calculo-1', designed: true },
      {
        n: 4,
        name: 'Tema con contexto externo',
        href: '/courses/topics/definicion-limite',
        designed: true,
      },
      {
        n: 19,
        name: 'Detalle de documento',
        href: '/documents/limites-continuidad',
        designed: true,
      },
      {
        n: 27,
        name: 'Confirmar eliminación',
        href: '/documents/limites-continuidad?confirm=1',
        designed: true,
      },
      { n: 39, name: 'Resultados de búsqueda', href: '/courses/search', designed: true },
      { n: 7, name: 'Perfil y ajustes', href: '/profile', designed: true },
      { n: 42, name: 'Centro de ayuda', href: '/profile/help', designed: true },
      { n: 43, name: 'Contactar soporte', href: '/profile/contact', designed: true },
    ],
  },
  {
    title: 'Chat con la mascota',
    screens: [
      { n: 5, name: 'Chat', href: '/conversation', designed: true },
      { n: 23, name: 'Conversaciones', href: '/chat', designed: true },
      { n: 24, name: 'Respondiendo', href: '/conversation/responding', designed: true },
      { n: 25, name: 'Error o límite', href: '/conversation/error', designed: true },
      { n: 10, name: 'Chat sin conexión', href: '/conversation/offline', designed: true },
      { n: 30, name: 'Fuera de tus documentos', href: '/conversation/outside', designed: true },
    ],
  },
  {
    title: 'Estudio',
    screens: [
      { n: 31, name: 'Configurar quiz', href: '/study/quiz-setup', designed: true },
      { n: 21, name: 'Quiz', href: '/study/quiz', designed: true },
      { n: 22, name: 'Flashcards', href: '/study/flashcards', designed: true },
      { n: 32, name: 'Repaso del día', href: '/study/review', designed: true },
    ],
  },
  {
    title: 'Cuenta, planes y compartir',
    screens: [
      { n: 26, name: 'Planes', href: '/plans', designed: true },
      { n: 38, name: 'Gestionar suscripción', href: '/profile/subscription', designed: true },
      { n: 34, name: 'Ajustes de notificaciones', href: '/profile/notifications', designed: true },
      { n: 40, name: 'Borrar cuenta', href: '/profile/delete-account', designed: true },
      {
        n: 35,
        name: 'Compartir resumen',
        href: '/courses/topics/definicion-limite?sheet=share',
        designed: true,
      },
      {
        n: 36,
        name: 'Enlace creado',
        href: '/courses/topics/definicion-limite?sheet=created',
        designed: true,
      },
      { n: 37, name: 'Resumen compartido (web)', href: '/s/Xk3m9', designed: true },
    ],
  },
  {
    title: 'Estados vacío y error',
    screens: [
      {
        n: 45,
        name: 'Búsqueda sin resultados',
        href: '/courses/search?demo=empty',
        designed: true,
      },
      { n: 46, name: 'Repaso sin tarjetas', href: '/study/review?demo=empty', designed: true },
      { n: 47, name: 'Cámara denegada', href: '/upload/scan?demo=denied', designed: true },
      { n: 48, name: 'Enlace caducado', href: '/s/expired', designed: true },
      {
        n: 49,
        name: 'Restaurar compras fallido',
        href: '/profile/subscription?demo=restore-failed',
        designed: true,
      },
      { n: 50, name: 'Cursos sin conexión', href: '/courses?demo=offline', designed: true },
      { n: 51, name: 'Inicio cargando (esqueleto)', href: '/home?demo=loading', designed: true },
      {
        n: 52,
        name: 'Borrar cuenta · confirmación incorrecta',
        href: '/profile/delete-account?demo=wrong',
        designed: true,
      },
    ],
  },
  {
    title: 'Agregadas a partir de la revisión',
    screens: [
      {
        n: 53,
        name: 'Vista de clase (definiciones, conceptos, ejercicios)',
        href: '/courses/class/c4',
        designed: false,
      },
      { n: 54, name: 'Editar perfil', href: '/profile/edit', designed: false },
      { n: 55, name: 'Términos y privacidad', href: '/legal/terms', designed: false },
      { n: 56, name: 'Nueva contraseña', href: '/reset-password', designed: false },
      { n: 57, name: 'Regreso de Google', href: '/auth-callback', designed: false },
      { n: 58, name: 'Confirmar mayoría de edad', href: '/confirm-age', designed: false },
    ],
  },
  {
    title: 'Panel de administración',
    screens: [
      { n: 59, name: 'Panel · Resumen', href: '/admin', designed: false },
      { n: 60, name: 'Panel · Usuarios', href: '/admin/users', designed: false },
      { n: 61, name: 'Panel · Documentos', href: '/admin/documents', designed: false },
      { n: 62, name: 'Panel · Auditoría', href: '/admin/audit', designed: false },
    ],
  },
  {
    title: 'Contenido',
    screens: [{ n: 63, name: 'Contenido del tema', href: '/topic', designed: false }],
  },
];

export const allScreens: ScreenEntry[] = screenGroups.flatMap((g) => g.screens);
